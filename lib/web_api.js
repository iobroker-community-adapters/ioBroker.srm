'use strict';

const { PROTOCOLS_LABEL, ERRORS_LABEL } = require('./const');

const getErrorMessage = response => {
    if (
        !Object.prototype.hasOwnProperty.call(response, 'error') ||
        !Object.prototype.hasOwnProperty.call(response.error, 'code')
    ) {
        return 'Unknown error (no code)';
    }
    return (
        ERRORS_LABEL[response.error.code] || `Unknown error (${response.error.code}) ${JSON.stringify(response.error)}`
    );
};

class SrmClient {
    /**
     * Create an instance of SRM client
     */
    constructor() {
        this.baseUrl = '';
        this.requestConfig = {};
        this.timeout = 5000;
        this.rejectUnauthorized = false;
        this.sid = null;
        this.protocol = '';
        this.hostname = '';
        this.port = '';
    }

    /**
     * Return protocol label
     *
     * @param protocol Protocol identifier
     * @returns Protocol label
     */
    getProtocolLabel(protocol) {
        return PROTOCOLS_LABEL[protocol] || 'Unknown';
    }

    /**
     * Low-level method for requesting SRM API
     *
     * @param path API path (example: '/webapi/entry.cgi')
     * @param data Data posted in form
     * @returns Data returned by the API
     */
    async request(path, data) {
        // prepare form data (x-www-form-urlencoded)
        const form = new URLSearchParams(data).toString();
        // prepare request options
        const options = {
            ...this.requestConfig,
            host: this.hostname,
            port: this.port,
            path,
            method: 'POST',
            rejectUnauthorized: this.rejectUnauthorized,
            timeout: this.timeout,
            headers: {
                ...this.requestConfig.headers,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(form),
            },
        };
        if (this.sid !== null) {
            // add session id in cookie
            options.headers.Cookie = `id=${this.sid}`;
        }

        // use adequate http(s) library
        const httpLib = this.protocol.startsWith('https') ? require('node:https') : require('node:http');
        // do the request
        const response = await new Promise((resolve, reject) => {
            const request = httpLib.request(options, resolve);
            request.on('error', error => reject(error));
            request.on('timeout', () => {
                request.destroy();
                reject(new Error('Request timeout'));
            });
            request.write(form);
            request.end();
        });

        // handle returned data
        const resultData = await new Promise((resolve, reject) => {
            response.setEncoding('utf8');
            // handle HTTP status
            if (response.statusCode < 200 || response.statusCode > 299) {
                reject(new Error(`${response.statusCode} ${response.statusMessage}`));
            }
            // handle data
            let resultRaw = '';
            response.on('data', chunk => (resultRaw += chunk));
            response.on('end', () => resolve(resultRaw));
        });
        const result = JSON.parse(resultData);

        // handle errors
        if (!Object.prototype.hasOwnProperty.call(result, 'success')) {
            throw new Error('Invalid response');
        }
        if (result.success === false) {
            // handle SRM error
            const error = getErrorMessage(result);
            throw new Error(error);
        }

        if (Object.prototype.hasOwnProperty.call(result, 'data')) {
            return result.data;
        }
    }

    /**
     * Authenticate with user credentials
     *
     * @param baseUrl Your router full URL ('https://10.0.0.1:8001')
     * @param sid Previous session identifier (receive from `authenticate` method)
     * @param requestConfig HTTP request configuration (see https://nodejs.org/api/https.html#httpsrequestoptions-callback)
     * @param account Your account login ('admin')
     * @param password Your account password
     * @returns Session identifier
     */
    async authenticate(baseUrl, sid = '', requestConfig = {}, account = '', password = '') {
        if (!baseUrl) {
            throw new Error('Router base URL must be provided');
        }
        this.baseUrl = baseUrl;
        this.requestConfig = requestConfig;
        this.timeout = requestConfig.timeout || 5000;
        this.rejectUnauthorized = requestConfig.rejectUnauthorized || false;
        this.sid = sid;
        const srmUrl = new URL(this.baseUrl);
        this.protocol = srmUrl.protocol;
        this.hostname = srmUrl.hostname;
        this.port = srmUrl.port;

        if (!account || !password) {
            throw new Error('Credentials must be provided');
        }
        const data = {
            account,
            passwd: password,
            method: 'Login',
            version: 2,
            api: 'SYNO.API.Auth',
        };
        const response = await this.request('/webapi/auth.cgi', data);
        if (!Object.prototype.hasOwnProperty.call(response, 'sid')) {
            throw new Error('No sid returned');
        }
        this.sid = response.sid;
        return response.sid;
    }

    /**
     * Logout (destroy session identifier)
     *
     * @returns
     */
    async logout() {
        const data = {
            method: 'Logout',
            version: 2,
            api: 'SYNO.API.Auth',
        };
        await this.request('/webapi/auth.cgi', data);
        this.sid = null;
    }

    /**
     * Retrieve Wifi network settings
     *
     * @returns Network settings
     */
    async getWifiNetworkSettings() {
        const data = {
            method: 'get',
            version: 1,
            api: 'SYNO.Wifi.Network.Setting',
        };
        return await this.request('/webapi/entry.cgi', data);
    }

    /**
     * Update Wi-Fi settings
     *
     * @param profiles
     */
    async setWifiNetworkSettings(profiles) {
        const data = {
            api: 'SYNO.Wifi.Network.Setting',
            method: 'set',
            version: 1,
            profiles: JSON.stringify(profiles),
        };
        await this.request('/webapi/entry.cgi', data);
    }

    /**
     * Retrieve WAN status
     *
     * @returns WAN status
     */
    async getConnectionStatus() {
        const data = {
            method: 'get',
            version: 1,
            api: 'SYNO.Core.Network.Router.ConnectionStatus',
        };
        return await this.request('/webapi/entry.cgi', data);
    }

    /**
     * Retrieve traffic by device
     *
     * @param interval Traffic interval among `'live', 'day', 'week', 'month'` (default is `'live'`)
     * @returns Network traffic by device
     */
    async getTraffic(interval = 'live') {
        if (!['live', 'day', 'week', 'month'].includes(interval)) {
            throw new Error("Interval must be in ['live', 'day', 'week', 'month']");
        }
        const data = {
            method: 'get',
            version: 1,
            mode: 'net',
            interval,
            api: 'SYNO.Core.NGFW.Traffic',
        };
        return await this.request('/webapi/entry.cgi', data);
    }

    /**
     * Retrieve utilization by network
     *
     * @returns Array of network interfaces with received/transmitted and timestamp
     */
    async getNetworkUtilization() {
        const data = {
            method: 'get',
            version: 1,
            resource: JSON.stringify(['network']),
            api: 'SYNO.Core.System.Utilization',
        };
        return await this.request('/webapi/entry.cgi', data);
    }

    /**
     * Retrieve known devices by router and information like IP, signal, etc...
     *
     * @param api_version
     * @returns Devices
     */
    async getAllDevices(api_version = 4) {
        const data = {
            method: 'get',
            version: api_version,
            conntype: 'all',
            api: 'SYNO.Core.Network.NSM.Device',
        };
        try {
            const nodes = (await this.request('/webapi/entry.cgi', data)).devices;
            return nodes;
        } catch (error) {
            if (error.message === 'This API version is not supported') {
                if (api_version > 1) {
                    const nodes = await this.getAllDevices(api_version - 1);
                    return nodes;
                }
                throw new Error('This API version is not supported');
            } else {
                throw new Error(error.message);
            }
        }
    }

    /**
     * Retrieve devices connected to Wi-Fi network and information like max rate, signal, etc...
     *
     * @returns Wifi devices
     */
    async getWifiDevices() {
        const data = {
            method: 'get',
            version: 1,
            api: 'SYNO.Mesh.Network.WifiDevice',
        };
        return (await this.request('/webapi/entry.cgi', data)).devices;
    }

    /**
     * Retrieve mesh nodes and information like max rate, status, number of connected devices, etc...
     *
     * @param api_version
     * @returns Mesh nodes
     */
    async getMeshNodes(api_version = 4) {
        const data = {
            method: 'get',
            version: api_version,
            api: 'SYNO.Mesh.Node.List',
        };
        try {
            const nodes = (await this.request('/webapi/entry.cgi', data)).nodes;
            return nodes;
        } catch (error) {
            if (error.message === 'This API version is not supported') {
                if (api_version > 1) {
                    const nodes = await this.getMeshNodes(api_version - 1);
                    return nodes;
                }
                throw new Error('This API version is not supported');
            } else {
                throw new Error(error.message);
            }
        }
    }

    /**
     * Retrieve smart WAN gateways
     *
     * @param gatewaytype Gateway type (default: `ipv4`)
     * @returns Smart WAN gateways list
     */
    async getSmartWanGateway(gatewaytype = 'ipv4') {
        const data = {
            api: 'SYNO.Core.Network.SmartWAN.Gateway',
            method: 'list',
            version: 1,
            gatewaytype: JSON.stringify(gatewaytype),
        };
        return (await this.request('/webapi/entry.cgi', data)).list;
    }

    /**
     * Retrieve smart WAN configuration
     *
     * @returns Smart WAN configuration
     */
    async getSmartWan() {
        const data = {
            api: 'SYNO.Core.Network.SmartWAN.General',
            method: 'get',
            version: 1,
        };
        return await this.request('/webapi/entry.cgi', data);
    }

    /**
     * Set smart WAN configuration
     *
     * @param wanConfig Updated smart WAN configuration
     * @returns Smart WAN configuration (example: `{ smartwan_mode: 'failover', dw_weight_ratio: 0, smartwan_ifname_1: 'wan', smartwan_ifname_2: 'lan1', smartwan_failback: true }`)
     */
    async setSmartWan(wanConfig) {
        if (typeof wanConfig !== 'object') {
            throw new Error('Invalid WAN config');
        }
        if (
            typeof wanConfig.dw_weight_ratio !== 'number' ||
            wanConfig.dw_weight_ratio < 0 ||
            wanConfig.dw_weight_ratio > 100
        ) {
            throw new Error('Invalid dw_weight_ratio');
        }
        if (
            ![
                'wan',
                'lan1',
                '3glte',
                'PPPoE-WAN',
                'PPPoE-LAN1',
                'vpn',
                'wifi24g',
                'wifi5g',
                'DS-Lite',
                'MapE',
            ].includes(wanConfig.smartwan_ifname_1)
        ) {
            throw new Error('Invalid smartwan_ifname_1');
        }
        if (
            ![
                'wan',
                'lan1',
                '3glte',
                'PPPoE-WAN',
                'PPPoE-LAN1',
                'vpn',
                'wifi24g',
                'wifi5g',
                'DS-Lite',
                'MapE',
            ].includes(wanConfig.smartwan_ifname_2)
        ) {
            throw new Error('Invalid smartwan_ifname_2');
        }
        if (!['failover', 'loadbalancing_failover'].includes(wanConfig.smartwan_mode)) {
            throw new Error('Invalid smartwan_mode');
        }
        const data = {
            api: 'SYNO.Core.Network.SmartWAN.General',
            method: 'set',
            version: 1,
            ...wanConfig,
        };
        return await this.request('/webapi/entry.cgi', data);
    }

    /**
     * Switch smart WAN interfaces
     *
     * @returns Smart WAN configuration
     */
    async switchSmartWan() {
        const current = await this.getSmartWan();
        const ifname1 = current.smartwan_ifname_1;
        current.smartwan_ifname_1 = current.smartwan_ifname_2;
        current.smartwan_ifname_2 = ifname1;
        return await this.setSmartWan(current);
    }

    /**
     * Retrieve policy rules
     *
     * @returns Policy rules
     */
    async getPolicyRoutes() {
        const data = {
            method: 'get',
            version: 1,
            api: 'SYNO.Core.Network.Router.PolicyRoute',
            type: 'ipv4',
        };
        return (await this.request('/webapi/entry.cgi', data)).rules;
    }

    /**
     * Set policy rules (require to provided all rules)
     *
     * @param rules Updated policy rules
     */
    async setPolicyRoutes(rules) {
        const data = {
            method: 'set',
            version: 1,
            api: 'SYNO.Core.Network.Router.PolicyRoute',
            type: 'ipv4',
            rules: JSON.stringify(rules),
        };
        await this.request('/webapi/entry.cgi', data);
    }

    /**
     * Retrieve devices where wake on lan is configured
     *
     * @returns Devices
     */
    async getWakeOnLanDevices() {
        const data = {
            api: 'SYNO.Core.Network.WOL',
            method: 'get_devices',
            version: 1,
            findhost: false,
            client_list: JSON.stringify([]),
        };
        return await this.request('/webapi/entry.cgi', data);
    }

    /**
     * Add wake on lan to the provided device
     *
     * @param mac Device MAC address
     * @param host Device hostname
     */
    async addWakeOnLan(mac, host = '') {
        const data = {
            api: 'SYNO.Core.Network.WOL',
            method: 'add_device',
            version: 1,
            mac: JSON.stringify(mac),
        };
        if (host) {
            data.host = JSON.stringify(host);
        }
        await this.request('/webapi/entry.cgi', data);
    }

    /**
     * Wake a device from LAN
     *
     * @param mac Device MAC address
     */
    async wakeOnLan(mac) {
        const data = {
            api: 'SYNO.Core.Network.WOL',
            method: 'wake',
            version: 1,
            mac: JSON.stringify(mac),
        };
        await this.request('/webapi/entry.cgi', data);
    }

    /**
     * Retrieve Quality Of Service rules by devices (guaranteed/maximum for upload/download and protocols)
     *
     * @returns Devices Qos rules
     */
    async getQos() {
        const data = {
            api: 'SYNO.Core.NGFW.QoS.Rules',
            method: 'get',
            version: 1,
        };
        return (await this.request('/webapi/entry.cgi', data)).rules;
    }

    /**
     * Retrieve access control groups (safe search)
     *
     * @param requestOnlineStatus Does the group online status has to be computed (require to request devices)
     * @param additional Additional information requested
     * @returns Access control groups
     */
    async getAccessControlGroups(requestOnlineStatus = false, additional = ['device', 'total_timespent']) {
        const data = {
            api: 'SYNO.SafeAccess.AccessControl.ConfigGroup',
            method: 'get',
            version: 1,
            additional: JSON.stringify(additional),
        };
        const groups = (await this.request('/webapi/entry.cgi', data)).config_groups;
        if (requestOnlineStatus === true) {
            try {
                const devices = await this.getAllDevices();
                this.computeAccessControlGroupStatus(groups, devices);
            } catch (error) {
                console.log(`Error during device recuperation: ${error.message}`);
            }
        }
        return groups;
    }

    /**
     * Compute online status for each access control groups
     *
     * @param groups Access control groups (from `getAccessControlGroups`) on which to add `online` status
     * @param devices Known devices (from `getDevices`)
     */
    computeAccessControlGroupStatus(groups, devices) {
        // filter online devices
        const onlineDevices = devices.filter(device => device.is_online === true).map(device => device.mac);
        // set access control group online status
        groups.forEach(group => {
            const groupOnlineDevices = group.devices.filter(mac => onlineDevices.includes(mac));
            group.online_device_count = groupOnlineDevices.length;
            group.online = group.online_device_count > 0;
        });
    }
}

module.exports = { SrmClient };
