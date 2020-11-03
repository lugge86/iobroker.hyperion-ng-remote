"use strict";

/*
 * Created with @iobroker/create-adapter v1.26.3
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
const request = require('request');

// Load your modules here, e.g.:
// const fs = require("fs");

class HyperionNgRemote extends utils.Adapter {

    sysinfoFinished = false;
    serverinfoFinished = false;
    adapterConnected = false;

    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: "hyperion-ng-remote",
        });
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        // this.on("objectChange", this.onObjectChange.bind(this));
        // this.on("message", this.onMessage.bind(this));
        this.on("unload", this.onUnload.bind(this));
    }


    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Initialize your adapter here

        // Reset the connection indicator during startup
        this.setState("info.connection", false, true);

        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // this.config:
        this.log.info("config User IP: " + this.config.gui_ip);
        this.log.info("config Port: " + this.config.gui_port);

        /*
        For every state in the system there has to be also an object of type state
        Here a simple template for a boolean variable named "testVariable"
        Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
        */
        await this.setObjectNotExistsAsync("selectPrio", {
            type: "state",
            common: {
                name: "testVariable",
                type: "number",
                role: "state",
                read: true,
                write: true,
            }
        });

        // In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
        this.subscribeStates("selectPrio");
        // You can also add a subscription for multiple states. The following line watches all states starting with "lights."
        // this.subscribeStates("lights.*");
        // Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
        // this.subscribeStates("*");

        /*
            setState examples
            you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
        */
        // the variable testVariable is set to true as command (ack=false)
        //await this.setStateAsync("testVariable", true);

        // same thing, but the value is flagged "ack"
        // ack should be always set to true if the value is received from or acknowledged from the target system
        //await this.setStateAsync("testVariable", { val: true, ack: true });

        // same thing, but the state is deleted after 30s (getState will return null afterwards)
        //await this.setStateAsync("testVariable", { val: true, ack: true, expire: 30 });

        // examples for the checkPassword/checkGroup functions
        //let result = await this.checkPasswordAsync("admin", "iobroker");
        //this.log.info("check user admin pw iobroker: " + result);

        //result = await this.checkGroupAsync("admin", "admin");
        //this.log.info("check group user admin group admin: " + result);


        this.conn = new HyperionApi("192.168.0.83", "8090", this.NotifyCallback.bind(this), this.log.info);
        //this.log.info( this.conn.GetJsonAddress() );
        this.conn.ServerInfo();
        this.conn.SysInfo();

        this.conn.Color( [255,0,0], 200, 0)
        this.conn.Color( [0,255,0], 201, 0)
        this.conn.Color( [0,0,255], 202, 0)

    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            // Here you must clear all timeouts or intervals that may still be active
            // clearTimeout(timeout1);
            // clearTimeout(timeout2);
            // ...
            // clearInterval(interval1);

            callback();
        } catch (e) {
            callback();
        }
    }

    // If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
    // You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
    // /**
    //  * Is called if a subscribed object changes
    //  * @param {string} id
    //  * @param {ioBroker.Object | null | undefined} obj
    //  */
    // onObjectChange(id, obj) {
    //     if (obj) {
    //         // The object was changed
    //         this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
    //     } else {
    //         // The object was deleted
    //         this.log.info(`object ${id} deleted`);
    //     }
    // }

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        if (state) {
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);

            switch(id){
                case "hyperion-ng-remote.0.selectPrio": {
                    this.conn.SourceSelection(state.val);
                    break;
                }
                default: {
                    break;
                }
            }

        } else {
            this.log.info(`state ${id} deleted`);
            //todo: throw error
        }
    }


    NotifyCallback(command, error)
    {
        this.log.info("callback for: " + command);

        if (error) {
            this.log.info("error with request: " + command);
        } else {
            switch(command) {
                case "serverinfo": {
                    this.serverinfoFinished = true;
                    break;
                }
                case "sysinfo": {
                    this.sysinfoFinished = true;
                    break;
                }
                case "color": {
                    break;
                }
                case "sourceselect": {
                    break;
                }
                default: {
                    break;
                }
            }

            if ( (this.adapterConnected == false) && (this.sysinfoFinished == true) && (this.serverinfoFinished == true) )
            {
                this.log.info("adapterConnected");
                this.adapterConnected = true
                this.setState("info.connection", true, true);
            }
        }
    }
}


class HyperionApi
{
    sysinfo = null;
    serverinfo = null;

    constructor(ip, port, notifyClbk, logger) {
        logger("Creating new Connection with IP "+ ip);
        this.callback = notifyClbk;
        this.logger = logger;
        this.jsonUrl = "http://" + ip + ":" + port + "/json-rpc";
    }

    SourceSelection(prio) {
        var requestJson = {
            command: "sourceselect",
            priority: prio
        };
        this.SendRequest(requestJson);
    }

    ServerInfo() {
        var requestJson = {
            command: "serverinfo",
            tan: 1
        };
        this.SendRequest(requestJson);
    }

    ServerInfoClbk(data) {
        //todo: store serverinfo data
    }

    GetServerInfoComponents() {
        ret = null;

        return ret;
    }

    GetServerInfoPriorities() {
        ret = null;

        return ret;
    }

    SysInfo() {
        var requestJson = {
            command: "sysinfo",
            tan: 1
        };
        this.SendRequest(requestJson);
    }

    SysInfoClbk(data) {
        //todo: store sysinfo data
    }

    GetSysInfo() {
        ret = null;

        return ret;
    }

    Color(color, prio, duration) {
        var requestJson = {
            command: "color",
            color: color,
            priority: prio,
            origin: "hyperion ng adapter"
            //todo
            //"duration": duration
        };
        this.SendRequest(requestJson);
    }

    Clear(prio) {
        var requestJson = {
            command: "clear",
            priority: prio
        };
        this.SendRequest(requestJson);
    }

    ClearAll() {
        this.Clear(-1);
    }

    SendRequest(requestJson) {
        /* first, create object containing all the needed options for our request */
        var requestString = JSON.stringify(requestJson);
        var requestOptions = {
            url: this.jsonUrl,
            method: 'POST',
            body: requestString,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': requestString.length
            }
        };

        /*
         * Now make the actual request.
         * The result will later be available in the request callback.
         */
        var self = this;
        request.post(requestOptions,
            function(error, response, body) {

                var retError = null;
                var retCommand = requestJson.command;

                if (error) {
                    /* this means request was not answered by hyperion */
                    self.logger("request not executed: " + requestJson.command);
                    self.logger(error)
                    retError = error;
                } else {
                    var responseJson = JSON.parse(body);
                    if (responseJson.success == false) {
                        /* request answered by hyperion, but with issues */
                        self.logger("request executed with issues: " + responseJson.command);
                        self.logger(responseJson.error)
                        retError = responseJson.error;
                    } else {
                        /* request was executed properly by hyperion */
                        self.logger("request executed properly: " + responseJson.command);
                        switch(responseJson.command) {
                            
                            case "serverinfo": {
                                break;
                            }
                            case "sysinfo": {
                                break;
                            }
                            case "color": {
                                break;
                            }
                            case "sourceselect": {
                                break;
                            }
                            default: {
                                break;
                            }
                        }
                    }
                }
                /* finally, notify application via callback */
                self.callback(retCommand, retError);                
            }
        );
    }

}



// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new HyperionNgRemote(options);
} else {
    // otherwise start the instance directly
    new HyperionNgRemote();
}



