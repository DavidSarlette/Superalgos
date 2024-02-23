exports.newAppClientNetworkNetworkNodePicker = function newAppClientNetworkNetworkNodePicker() {
    let thisObject = {
        pickOneNetworkNode: pickOneNetworkNode,
        filteredNetworkNodes: filteredNetworkNodes
    }

    const localhostRegex = /127\.\d+\.\d+\.\d+/
    const network192Regex = /192\.\d+\.\d+\.\d+/
    const network10Regex = /10\.\d+\.\d+\.\d+/
    const network100Regex = /100\.\d+\.\d+\.\d+/
    const network168Regex = /168\.\d+\.\d+\.\d+/
    const network172Regex = /172\.\d+\.\d+\.\d+/

    return thisObject

    function pickOneNetworkNode() {
    }

    /**
     * The default will return a full list including all local network addresses, 
     * to change this behaviour filters need to be applied
     * @param {Network[]} p2pNetworkNodes 
     * @param {Filters | undefined} filters
     * @returns {Network[]}
     */
    function filteredNetworkNodes(p2pNetworkNodes, filters) {
        const me = whoami()
        const validNetworkNodes = p2pNetworkNodes.filter(isValidNetworkNode)
        if(filters !== undefined) {
            if (filters.onlyMe) {
                if(filters.includeLocalNetworks !== undefined && !filters.includeLocalNetworks) {
                    return validNetworkNodes.filter(n => n.userProfile.name == me && !isLocalNetwork(n.node.config.host))
                }
                return validNetworkNodes.filter(n => n.userProfile.name == me)
            }
            if (filters.users !== undefined && filters.users.length > 0) {
                const filteredUserNetworks = validNetworkNodes.filter(n => filters.users.indexOf(n.userProfile.name) > -1)
                if(!!filters.includeLocalNetworks) {
                    return filteredUserNetworks
                }
                return filteredUserNetworks.filter(n => !isLocalNetwork(n.node.config.host))
            }
            if(filters.includeLocalNetworks !== undefined && !filters.includeLocalNetworks) {
                return validNetworkNodes.filter(n => !isLocalNetwork(n.node.config.host))
            }
        }
        return validNetworkNodes
    }

    /**
     * 
     * @param {NetworkNode | undefined} node 
     * @returns {boolean}
     */
    function isValidNetworkNode(network) {
        const node = network.node
        const isValid = node === undefined 
            || node.config === undefined
            || node.config.host === undefined
        return !isValid
    }

    /**
     * Tests if the host is part of a local or internal network
     * 
     * @param {string} host 
     * @returns {boolean}
     */
    function isLocalNetwork(host) {
        return host == 'localhost'
            || localhostRegex.test(host)
            || network192Regex.test(host)
            || network10Regex.test(host)
            || network100Regex.test(host)
            || network172Regex.test(host)
            || network168Regex.test(host)
    }

    /**
     * @returns {string} current user profile name
     */
    function whoami() {
        try {
            const rawFile = SA.nodeModules.fs.readFileSync(global.env.PATH_TO_SECRETS + '/githubCredentials.json')
            const contents = JSON.parse(rawFile)
            if (contents.githubUsername) {
                return contents.githubUsername
            }
        } catch (_) {
            // there must be an issue with the github credentials file so we will move on to try the workspace file instead
        }
        try {
            const rawFile = SA.nodeModules.fs.readFileSync(global.env.PATH_TO_SECRETS + '/workspace-credentials.json')
            const contents = JSON.parse(rawFile)
            const githubCredentials = contents.filter(x => x.type == 'github')
            if (githubCredentials.length > 0) {
                return githubCredentials[0].key
            }
        } catch (_) {
            // there must be an issue with the workspace credentials file we will try something else instead
        }
        // TODO: use child process to get git 'origin' remote and decipher the username from this
        return ''
    }
}

/**
 * @typedef Network
 * @property {{name: string}} userProfile
 * @property {NetworkNode} node
 */

/**
 * @typedef NetworkNode
 * @property {NetworkNodeConfig | undefined} config
 */

/**
 * @typedef NetworkNodeConfig
 * @property {string | undefined} host
 */

/**
 * @typedef Filters
 * @property {boolean | undefined} includeLocalNetworks 
 * @property {boolean | undefined} onlyMe defaults to including local network addresses to override specify includesLocalNetworks = false
 * @property {string[] | undefined} users defaults to excluding local network addresses to override specify includesLocalNetworks = true
 */