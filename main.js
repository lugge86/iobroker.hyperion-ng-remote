"use strict";

/*
 * Created with @iobroker/create-adapter v1.26.3
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
const request = require('request');
const schedule = require('node-schedule');

// Load your modules here, e.g.:
// const fs = require("fs");


class HyperionNgRemote extends utils.Adapter {

    cycleTimer = null;
    currentState = null;

    states = {
        init: 1,
        connecting: 2,
        cleaning: 3,
        configuring: 4,
        ready: 5,
        error: 6,
        recovering: 7,
        waiting: 8
    };

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
         this.on("message", this.onMessage.bind(this));
        this.on("unload", this.onUnload.bind(this));

        this.currentState = this.states.init;
        
        this.responseError = false;
        this.sysinfoFinished = false;
        this.serverinfoFinished = false;
        this.configElementsRequested = 0;
        this.configElementsConfirmed = 0;
        this.deleteionRequested = 0;
        this.deleteionConfirmed = 0;
        this.recoveryFinished = false;
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
        this.log.info("config User IP: " + this.config.serverIp);
        this.log.info("config Port: " + this.config.serverPort);
        


        /*
        For every state in the system there has to be also an object of type state
        Here a simple template for a boolean variable named "testVariable"
        Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
        */


        // In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.

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


        this.ProcessStateMachine();
        this.cycleTimer = schedule.scheduleJob("*/5 * * * * *", this.ProcessStateMachine.bind(this)  );
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


    onMessage(obj) {
        if (typeof obj === "object") {

            /* actions depend on command */
            this.log.info("message received: " + obj.command);

            if (obj.command === "GetEffectList") {
                /* share our effect list */
                if (obj.callback) {
                    this.sendTo(obj.from, obj.command, this.conn.GetEffectList(), obj.callback);
                }
            } else if (obj.command === "ConfigSanityCheck") {
                /* make a sanity check on the given config */
                if (obj.callback) {
                    this.sendTo(obj.from, obj.command, this.ConfigSanityCheck(obj.message), obj.callback);
                }
            }
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
        if (this.currentState == this.states.ready) {
            if (state) {

                switch(id){
                    case "hyperion-ng-remote.0.activePriority": {
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
    }


    NotifyCallback(command, error) {
        if (error) {
            if (error == "timeout") {
                this.log.info("timeout!!");
            }
            this.responseError = true;
        } else {
            switch(command) {
                case "serverinfo": {
                    this.serverinfoFinished = true;
                    this.UpdateDatapointsPriority();
                    break;
                }
                case "sysinfo": {
                    this.sysinfoFinished = true;
                    //this.UpdateDatapointsSysinfo();
                    break;
                }
                case "color": {
                    this.configElementsConfirmed++;
                    break;
                }
                case "effect": {
                    this.configElementsConfirmed++;
                    break;
                }
                case "sourceselect": {
                    break;
                }
                case "clear": {
                    this.deleteionConfirmed++;
                    break;
                }
                default: {
                    break;
                }
            }
        }

        this.ProcessStateMachine();
    }
    
        
    UpdateDatapointsPriority() {
        var availablePriorities = this.conn.GetPriorities();
        for (var priority of availablePriorities) {
            var folderName = "Priorities."+this.PrioToName(priority.priority);
            
            this.setState(folderName+".componentId", priority.componentId, true);
            this.setState(folderName+".origin", priority.origin, true);
            this.setState(folderName+".priority", priority.priority, true);
            this.setState(folderName+".owner", priority.owner, true);
            this.setState(folderName+".active", priority.active, true);
            this.setState(folderName+".visible", priority.visible, true);
        }   
    }
    
    
    UpdateDatapointsSysinfo() {
        
        var sysinfo = this.conn.GetSysInfo();
        
        if (!sysinfo)
        {
            this.log.info("error");
        }
        
        this.setState("SystemInfo.Hyperion.build", sysinfo.info.hyperion.build, true);
        this.setState("SystemInfo.Hyperion.gitremote", sysinfo.info.hyperion.gitremote, true);
        this.setState("SystemInfo.Hyperion.time", sysinfo.info.hyperion.time, true);
        this.setState("SystemInfo.Hyperion.version", sysinfo.info.hyperion.version, true);
        this.setState("SystemInfo.Hyperion.id", sysinfo.info.hyperion.id, true);
        
        this.setState("SystemInfo.System.architecture", sysinfo.info.system.architecture, true);
        this.setState("SystemInfo.System.hostName", sysinfo.info.system.hostName, true);
        this.setState("SystemInfo.System.kernelType", sysinfo.info.system.kernelType, true);
        this.setState("SystemInfo.System.kernelVersion", sysinfo.info.system.kernelVersion, true);
        this.setState("SystemInfo.System.prettyName", sysinfo.info.system.prettyName, true);
        this.setState("SystemInfo.System.productType", sysinfo.info.system.productType, true);
        this.setState("SystemInfo.System.productVersion", sysinfo.info.system.productVersion, true);
        this.setState("SystemInfo.System.wordSize", sysinfo.info.system.wordSize, true);
    }
    

    async ProcessStateMachine() {
        /* actions depend on current state of the adapter */
        switch (this.currentState) {

            case this.states.init: {
                if (this.ConfigSanityCheck(this.config) == false) {
                    /* error with config, no connection to server possible */
                    this.currentState = this.states.error;
                    this.log.info("config error; please check your adapter configuration");
                    this.log.info("init => error");                    
                } else {
                    /* create hyperion api obj and send initial commands to get some information from server */
                    this.conn = new HyperionApi(this.config.serverIp, this.config.serverPort, this.config.appname, this.NotifyCallback.bind(this), this.log.info, 30000);
                    this.conn.ServerInfo();
                    this.conn.SysInfo();

                    this.currentState = this.states.connecting;
                    this.log.info("init => connecting");
                }

                break;
            }

            case this.states.connecting: {
                /*
                 * In this state we just wait till we are "connected" to hyperion,
                 * this is when the serverinfo and sysinfo commands have returned.
                 */
                if ( (this.sysinfoFinished == true) && (this.serverinfoFinished == true) ) {
                    /* start cleaning the server from old configuration data */
                    this.DeletePriorities();

                    this.currentState = this.states.cleaning;
                    this.log.info("connecting => cleaning");
                    
                } else if (this.responseError == true) {
                    this.currentState = this.states.recovering;
                    this.log.info("connecting => recovering");
                }

                break;
            }

            case this.states.cleaning: {

                if( this.deleteionRequested == this.deleteionConfirmed ) {
                    /* now write our color and effect configuration to hyperion */
                    this.WriteConfig();

                    this.currentState = this.states.configuring;
                    this.log.info("cleaning => configuring");
                    
                } else if (this.responseError == true) {
                    this.currentState = this.states.recovering;
                    this.log.info("cleaning => recovering");
                }
                

                break;
            }

            case this.states.configuring: {
                /*
                 * Here we wait till all configuration jobs have been
                 * confirmed by hyperion server.
                 */

                if ( this.configElementsRequested == this.configElementsConfirmed ) {
                    /* all went well, create DPs and set adapter info to "connected" */
                    this.CreateDataPoints();
                    this.setState("info.connection", true, true);

                    this.currentState = this.states.ready;
                    this.log.info("configuring => ready");
                    
                } else if (this.responseError == true) {
                    this.currentState = this.states.recovering;
                    this.log.info("configuring => recovering");
                }

                break;
            }

            case this.states.ready: {
                /* nothing to do here, this is the normal operation mode */
                if (this.responseError == true) {
                    this.currentState = this.states.recovering;
                    this.log.info("ready => recovering");
                }
                break;
            }
            
            case this.states.recovering: {
                
                /* reset all flags */
                this.setState("info.connection", false, true);
                this.responseError = false;
                this.sysinfoFinished = false;
                this.serverinfoFinished = false;
                this.configElementsRequested = 0;
                this.configElementsConfirmed = 0;
                this.deleteionRequested = 0;
                this.deleteionConfirmed = 0;
                this.recoveryFinished = false;
                
                setTimeout( () => {
                    this.recoveryFinished  = true;
                }, 30000);

                this.currentState = this.states.waiting;
                this.log.info("recovering => waiting");
                break;
            }

            case this.states.waiting: {
                
                if (this.recoveryFinished == true) {
                    this.recoveryFinished = false;                                    
                    this.currentState = this.states.init;
                    this.log.info("waiting => init");
                }
                break;
            }

            case this.states.error: {
                /* do nothing */
                break;
            }

            default: {
                break;
            }

            this.ProcessStateMachine();
        }
    }


    ConfigSanityCheck(config) {

        var configSane = true;

        /* check if port is in allowed range */
        if ( (config.serverPort < 0) || (config.serverPort > 65535) ) {
            configSane = false;
        }
        
        {
            var prioArray = new Array();
            for (var color of config.colors) {
                prioArray.push(color.prio);
            }
            for (var effect of config.effects) {
                prioArray.push(effect.prio);
            }
            if (new Set(prioArray).size != prioArray.length) {
                configSane = false;
            }
        }        

        return configSane;
    }
    
    
    PrioToName(prio) {        
        /* Todo: a map would be better here */
        var name = null;        
        for (var color of this.config.colors) {
            if (color.prio == prio) {
                name = color.name;
                break;
            }
        }        
        if (name == null) {
            for (var effect of this.config.effects) {
                if (effect.prio == prio) {
                    name = effect.name;
                    break;
                }        
            }
        }        
        if (name == null) {
            name = prio.toString();
        }        
        return name;
    }


    DeletePriorities() {
        var configuredPrios = this.conn.GetPriorities()
        for (var prio of configuredPrios) {
            if ( prio.origin.includes(this.config.appname) ) {
                /* this was set by us in an previous run, thus, get rid of it */
                this.conn.Clear(prio.priority);
                this.deleteionRequested++;
            }
        }
    }
    
    
    ReInit() {
    }
    

    async CreateDataPoints() {

        /* data point for directly setting the active priority */
        await this.setObjectNotExistsAsync("activePriority", {type: "state", common: {name: "select active priority", type: "number", role: "state", read: true, write: true } });
        this.subscribeStates("activePriority");

        /* create data points for each configured prio, register only the active-trigger */
        var availablePriorities = this.conn.GetPriorities();
        for (var priority of availablePriorities) {
            
            var folderName = "Priorities."+this.PrioToName(priority.priority);            
            
            await this.setObjectNotExistsAsync(folderName+".componentId",   {type: "state",   common: {name: "componentId of this priority", type: "string", role: "state", read: true, write: false} });
            await this.setObjectNotExistsAsync(folderName+".origin",        {type: "state",   common: {name: "Origin of this priority", type: "string", role: "state", read: true, write: false} });
            await this.setObjectNotExistsAsync(folderName+".priority",      {type: "state",   common: {name: "priority of this priority", type: "number", role: "state", read: true, write: false} });
            await this.setObjectNotExistsAsync(folderName+".owner",         {type: "state",   common: {name: "owner of this priority", type: "string", role: "state", read: true, write: false} });
            await this.setObjectNotExistsAsync(folderName+".active",        {type: "state",   common: {name: "prioritiy is active for selection", type: "boolean", role: "state", read: true, write: false} });
            await this.setObjectNotExistsAsync(folderName+".visible",        {type: "state",   common: {name: "set priority visible", type: "boolean", role: "state", read: true, write: true} });
            this.subscribeStates(folderName+".active");            
        }
        this.UpdateDatapointsPriority();
        
        
        
        var sysinfo = this.conn.GetSysInfo();
        await this.setObjectNotExistsAsync("SystemInfo.Hyperion.build",     {type: "state",   common: {name: "componentId of this priority", type: "string", role: "state", read: true, write: false} });
        await this.setObjectNotExistsAsync("SystemInfo.Hyperion.gitremote", {type: "state",   common: {name: "componentId of this priority", type: "string", role: "state", read: true, write: false} });
        await this.setObjectNotExistsAsync("SystemInfo.Hyperion.time",      {type: "state",   common: {name: "componentId of this priority", type: "string", role: "state", read: true, write: false} });
        await this.setObjectNotExistsAsync("SystemInfo.Hyperion.version",   {type: "state",   common: {name: "componentId of this priority", type: "string", role: "state", read: true, write: false} });
        await this.setObjectNotExistsAsync("SystemInfo.Hyperion.id",        {type: "state",   common: {name: "componentId of this priority", type: "string", role: "state", read: true, write: false} });        
        await this.setObjectNotExistsAsync("SystemInfo.System.architecture",{type: "state",   common: {name: "componentId of this priority", type: "string", role: "state", read: true, write: false} });
        await this.setObjectNotExistsAsync("SystemInfo.System.hostName",    {type: "state",   common: {name: "componentId of this priority", type: "string", role: "state", read: true, write: false} });
        await this.setObjectNotExistsAsync("SystemInfo.System.kernelType",  {type: "state",   common: {name: "componentId of this priority", type: "string", role: "state", read: true, write: false} });
        await this.setObjectNotExistsAsync("SystemInfo.System.kernelVersion",{type: "state",   common: {name: "componentId of this priority", type: "string", role: "state", read: true, write: false} });
        await this.setObjectNotExistsAsync("SystemInfo.System.prettyName",  {type: "state",   common: {name: "componentId of this priority", type: "string", role: "state", read: true, write: false} });
        await this.setObjectNotExistsAsync("SystemInfo.System.productType", {type: "state",   common: {name: "componentId of this priority", type: "string", role: "state", read: true, write: false} });
        await this.setObjectNotExistsAsync("SystemInfo.System.productVersion",{type: "state",   common: {name: "componentId of this priority", type: "string", role: "state", read: true, write: false} });
        await this.setObjectNotExistsAsync("SystemInfo.System.wordSize",    {type: "state",   common: {name: "componentId of this priority", type: "string", role: "state", read: true, write: false} });
        this.UpdateDatapointsSysinfo();
    }


    WriteConfig() {
        /*
         * We need a little helper function to convert the color string (e.g. #12AB3F)
         * from the adapter config into an array of RGB values.
         */
        const hexToRgb = function (hex) {
            var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? [
            parseInt(result[1], 16),
            parseInt(result[2], 16),
            parseInt(result[3], 16)
            ] : null;
        }

        /* take every color from user configuration and send it to hyperion server */
        for(var color of this.config.colors) {
            this.conn.Color( hexToRgb(color.color), Number(color.prio), 0);
            this.configElementsRequested++;
        }

        /* then do the same again with the effects... */
        for(var effect of this.config.effects) {
            this.conn.Effect( effect.effect, Number(effect.prio), 0);
            this.configElementsRequested++;
        }
    }
}




class HyperionApi
{
    sysinfo = null;
    serverinfo = null;

    constructor(ip, port, origin, notifyClbk, logger, timeout) {
        this.origin = origin;
        this.callback = notifyClbk;
        this.logger = logger;
        this.jsonUrl = "http://" + ip + ":" + port + "/json-rpc";
        this.timeout = timeout;
    }

    SourceSelection(prio) {
        var requestJson = {
            command: "sourceselect",
            priority: prio
        };
        this.SendRequest(requestJson);
    }

/***********************************************************/
    ServerInfo() {
        var requestJson = {
            command: "serverinfo",
            tan: 1
        };
        this.SendRequest(requestJson);
    }

    ServerInfoClbk(data) {
        this.serverinfo = data;
    }

    GetPriorities() {
        return this.serverinfo.info.priorities;
    }

/***********************************************************/
    SysInfo() {
        var requestJson = {
            command: "sysinfo",
            tan: 1
        };
        this.SendRequest(requestJson);
    }

    SysInfoClbk(data) {
        this.sysinfo = data;
    }

    GetSysInfo() {
        return this.sysinfo;
    }

/***********************************************************/
    ComponentState(name, enabled) {
        var requestJson = {
            command: "componentstate",
            componentstate: {
                component: name,
                state: enabled
            }
        };
        this.SendRequest(requestJson);
    }

    GetComponentList() {
        return this.serverinfo.info.components;
    }

/***********************************************************/
    GetEffects() {
        return this.serverinfo.info.effects;
    }

    GetEffectList() {
        var ret = new Array();

        if (this.serverinfo) {
            for (var effect of this.serverinfo.info.effects) {
                ret.push(effect.name);
            }
        }

        return ret;
    }

/***********************************************************/
    Color(color, prio, duration) {
        var requestJson = {
            command: "color",
            color: color,
            priority: prio,
            origin: this.origin
            //todo
            //"duration": duration
        };
        this.SendRequest(requestJson);
    }

/***********************************************************/
    Effect(effect, prio, duration) {
        var requestJson = {
            command: "effect",
            effect: {
                name: effect
            },
            priority: prio,
            origin: this.origin
            //todo
            //"duration": duration
        };
        this.SendRequest(requestJson);
    }

/***********************************************************/
    Clear(prio) {

        if (prio > 253)
        {
            //todo: throw error
            return;
        }

        var requestJson = {
            command: "clear",
            priority: prio
        };
        this.SendRequest(requestJson);
    }

    ClearAll() {
        this.Clear(-1);
    }

/***********************************************************/
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
        
        this.logger("sending request: " + requestJson.command);
        
        
        var timeout = setTimeout(this.HandleTimeout.bind(this), this.timeout, requestJson.command); // Hello, John
        
        var self = this;
        request.post(requestOptions,
            function(error, response, body) {

                /* first, clear the timeout because we have some kind of response from server */
                clearTimeout(timeout);
                
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
                                self.ServerInfoClbk(responseJson);
                                break;
                            }
                            case "sysinfo": {
                                self.SysInfoClbk(responseJson);
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
    
    
    HandleTimeout(command) {
        this.logger("timeout!");
        this.callback(command, "timeout");
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



