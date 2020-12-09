"use strict";

/*
 * Created with @iobroker/create-adapter v1.26.3
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
const request = require('request');
const schedule = require('node-schedule');



class HyperionNgRemote extends utils.Adapter {

    cycleTimer = null;
    currentState = null;

    states = {
        init: 1,
        connecting: 2,
        cleaning: 3,
        configuring: 4,
        running: 5,
        error: 6,
        recovering: 7,
        waiting: 8
    };


    constructor(options) {
        super({
            ...options,
            name: "hyperion-ng-remote",
        });
        this.on("ready", this.AdapterInit.bind(this));
        this.on("stateChange", this.StateChangeCallback.bind(this));
         this.on("message", this.MessageCallback.bind(this));
        this.on("unload", this.AdapterShutdown.bind(this));

        this.currentState = this.states.init;
        
        this.responseError = false;
        this.sysinfoFinished = false;
        this.serverinfoFinished = false;
        this.configElementsRequested = 0;
        this.configElementsConfirmed = 0;
        this.deleteionRequested = 0;
        this.deleteionConfirmed = 0;
        this.recoveryFinished = false;
        this.serverInfoTimer = null;
        this.cycleTimer = null;
    }


    async AdapterInit() {

        /* we are not connected at the beginning (this will affect the state shown in admin adapter instance tab) */
        this.setState("info.connection", false, true);

        /* all further work is handled by or main function, which needs to be called cyclically */
        this.MainFunction();
        this.cycleTimer = schedule.scheduleJob("*/5 * * * * *", this.MainFunction.bind(this)  );
    }


    AdapterShutdown(callback) {
        try {
            //todo: stop all pending timers
            callback();
        } catch (e) {
            callback();
        }
    }

    
    MainFunction() {
        this.ProcessStateMachine();
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
                    this.conn = new HyperionApi(this.config.serverIp, this.config.serverPort, this.config.appname, this.NotifyCallback.bind(this), this.log.info, 45000);
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
                    /* all old config is deleted, now write our new configuration to hyperion */
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
                    this.serverinfoFinished = false;
                    this.conn.ServerInfo();
                    this.currentState = this.states.checking;
                    this.log.info("configuring => checking");
                    
                } else if (this.responseError == true) {
                    this.currentState = this.states.recovering;
                    this.log.info("configuring => recovering");
                }
                break;
            }
            
            case this.states.checking: {
                if (this.serverinfoFinished == true) {
                    
                    if (this.ServerConfigChanged() == false) {                        
                        /*
                        * Now that all configuration went well, we can set up a few things:
                        * - create all the data points
                        * - set info state, this will make the admin adapter show our instance as "connected"
                        * - set a schedule so that we get a cyclic ServerInfo to keep track of changes on server side
                        */
                        this.CreateStates();
                        this.setState("info.connection", true, true);
                        this.serverInfoTimer = schedule.scheduleJob("*/60 * * * * *", () => {this.conn.ServerInfo();} );

                        this.currentState = this.states.running;
                        this.log.info("checking => running");
                    } else {
                        this.currentState = this.states.recovering;
                        this.log.info("checking => recovering");
                    }
                    break;
                    
                }
            }

            case this.states.running: {
                
                if ( (this.responseError == true) || (this.ServerConfigChanged() == true) ) {
                    
                    if (this.responseError == true) {
                        this.log.info("response error occured");
                    } else {
                        this.log.info("server configuration has changed");
                    }
                    
                    /* stop asking for serverinfos */
                    if (this.serverInfoTimer) {
                        this.serverInfoTimer.cancel();
                    }
                    
                    this.currentState = this.states.recovering;
                    this.log.info("running => recovering");
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
                this.serverInfoTimer = null;
                
                setTimeout( () => {
                    this.recoveryFinished  = true;
                }, 70000);

                this.currentState = this.states.waiting;
                this.log.info("recovering => waiting");
                break;
            }

            case this.states.waiting: {
                
                if (this.recoveryFinished == true) {                                        
                    this.conn.ServerInfo();
                    this.conn.SysInfo();

                    this.currentState = this.states.connecting;                    
                    this.log.info("waiting => connecting");
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

            //Todo: ???
            this.ProcessStateMachine();
        }
    }
    
    MessageCallback(obj) {
        if (typeof obj === "object") {

            /* actions depend on command */
            
            
            
            
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

    
    async StateChangeCallback(id, state) {
            
            if (state) {
                
                /* we do only stuff when the stateChange comes from user; this can be checked with the ack flag */
                if ( (this.currentState == this.states.running) && (state.ack == false) ) {
                    switch( this.IdWithoutPath(id) ){
                        case "trigger": {
                            /* set new priority according to user's wish */
                            this.conn.SourceSelection(state.val);
                            break;
                        }
                        case "triggerByName": {
                            /* before we can set the new priority, we have to map the name to a prio number */
                            this.conn.SourceSelection( this.NameToPrio(state.val) );
                            break;
                        }
                        case "visible": {
                            /* first we have to get the priority of which the visibility shall be changed */
                            var prioState = await this.getStateAsync( this.PathFromId(id) + ".priority" );
                            var prio = prioState.val;
                            if (state.val == true) {
                                /* user wants to set priority visible, thus, just execute a SourceSelection */
                                this.conn.SourceSelection(prio);
                            } else {
                                /* setting to false is not supported at the moment, this would mean no prio is active */
                            }
                            
                            break;
                        }
                        default: {
                            break;
                        }
                    }
                }

            } else {
                this.log.info(`state ${id} deleted`);
                //todo: throw error
            }
        
    }


    
    NotifyCallback(command, error) {
        if (error) {
            this.responseError = true;
            this.log.info("error in response for command: " + command);
            this.log.info(error);
        } else {
            this.log.debug("request executed properly: " + command);
            switch(command) {
                case "serverinfo": {
                    /* remember success for later use */
                    this.serverinfoFinished = true;
                    
                    /* everytime we receive a ServerInfo, we can update all our data points */
                    this.UpdateDatapointsPriority();
                    break;
                }
                case "sysinfo": {
                    /* remember success for later use */
                    this.sysinfoFinished = true;
                    break;
                }
                case "color": {
                    /* we have to count the responses in order to know when configuration is complete */
                    this.configElementsConfirmed++;
                    break;
                }
                case "effect": {
                    /* we have to count the responses in order to know when configuration is complete */
                    this.configElementsConfirmed++;
                    break;
                }
                case "sourceselect": {
                    /*
                     * If a SourceSelect was successful during running state,
                     * we just execute a ServerInfo afterwards.
                     * This is necessary in order to update all the data points */
                    if (this.currentState == this.states.running) {                        
                        setTimeout( () => { this.conn.ServerInfo(); }, 1400);
                    }
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
        var activePriority = null;
        var availablePriorities = this.conn.GetPriorities();
        
        for (var priority of availablePriorities) {
            var folderName = "Priorities."+this.PrioToName(priority.priority);
            
            this.setState(folderName+".componentId", priority.componentId, true);
            this.setState(folderName+".origin", priority.origin, true);
            this.setState(folderName+".priority", priority.priority, true);
            this.setState(folderName+".owner", priority.owner, true);
            this.setState(folderName+".active", priority.active, true);
            this.setState(folderName+".visible", priority.visible, true);
            
            if (priority.visible == true) {
                activePriority = priority.priority;
            }
        }
        
        this.setState("trigger", activePriority, true);
        this.setState("triggerByName", this.PrioToName(activePriority), true);
        this.log.info("active: "+activePriority);
    }
    
    
    UpdateDatapointsSysinfo() {        
        var sysinfo = this.conn.GetSysInfo();
        
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
    
    
    ServerConfigChanged() {        
        var ret = false;        
        var priosConfigured = this.config.colors.length + this.config.effects.length;
        var priosInServer = 0;
        
        for (var prio of this.conn.GetPriorities() ) {
            if (prio.origin.includes(this.config.appname)) {
                priosInServer++;                
            }
        }
        
        if (priosInServer != priosConfigured) {
            ret = true;
            this.log.debug("Priorities in server config: " + priosInServer);
            this.log.debug("Priorities in adapter config: " + priosConfigured);
        }        
        
        return ret;        
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
    
    
    NameToPrio(name) {
        var prio = null;
        
        for (var color of this.config.colors) {
            if (color.name == name) {
                prio = color.prio;
                break;
            }
        }
        if (prio == null) {
            for (var effect of this.config.effects) {
                if (effect.name == name) {
                    prio = effect.prio;
                    break;
                }        
            }
        }
        
        return prio;
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
    
    
    PathFromId(id) {
        var tmpArr = id.split(".");
        var ret = "";
        
        for (var i=0; i<(tmpArr.length-1); i++) {
            ret = ret + tmpArr[i] + ".";
        }
        return ret.slice(0, -1)
    }
    
    
    IdWithoutPath(id) {
        return id.split(".").pop();
    }


    DeletePriorities() {
        var configuredPrios = this.conn.GetPriorities()
        this.deleteionConfirmed = 0;
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
    

    async CreateStates() {
        
        /* data point for directly setting the active priority */
        await this.setObjectNotExistsAsync("trigger",       {type: "state", common: {name: "select active priority", type: "number", role: "state", read: true, write: true } });
        await this.setObjectNotExistsAsync("triggerByName", {type: "state", common: {name: "select active priority", type: "string", role: "state", read: true, write: true } });
        this.subscribeStates("trigger");
        this.subscribeStates("triggerByName");

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
            this.subscribeStates(folderName+".visible");            
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
            subscribe:["priorities-update"],
            tan: 1
        };
        this.SendRequest(requestJson);
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
                    retError = error;
                } else {
                    var responseJson = JSON.parse(body);
                    if (responseJson.success == false) {
                        /* request answered by hyperion, but with issues */
                        retError = responseJson.error;
                    } else {
                        /* request was executed properly by hyperion */
                        /* now, depending on the received message, further actions are necessary */
                        switch(responseJson.command) {
                            case "serverinfo": {
                                self.serverinfo = responseJson;
                                break;
                            }
                            case "sysinfo": {
                                self.sysinfo = responseJson;
                                break;
                            }
                            default: {
                                break;
                            }
                        }
                    }
                }
                
                /* finally, notify the application via callback */
                self.callback(retCommand, retError);
            }
        );
    }
    
    
    HandleTimeout(command) {
        this.callback(command, "timeout detected by application");
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



