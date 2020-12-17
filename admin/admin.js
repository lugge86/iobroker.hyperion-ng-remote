    var colorConfig = [];
    var effectConfig = [];
    var backend = adapter + "." + instance;

    /* load() is executed by admin adapter everytime the adapter config gui is loaded */
    function load(settings, onChange) {

        /* if no settings available, return because nothing to do */
        if (!settings) {
            return;
        }

        // example: select elements with id=key and class=value and insert value
        $('.cfgval-simple').each(function () {
            var $key = $(this);
            var id = $key.attr('id');
            if ($key.attr('type') === 'checkbox') {
                // do not call onChange direct, because onChange could expect some arguments
                $key.prop('checked', settings[id])
                    .on('change', () => onChange())
                    ;
            } else {
                // do not call onChange direct, because onChange could expect some arguments
                $key.val(settings[id])
                    .on('change', () => onChange())
                    .on('keyup', () => onChange())
                    ;
            }
        });

        colorConfig = settings.colors || [];
        effectConfig = settings.effects || [];

        onChange(false);
        
        
        effectSelect = $('.hng-config-value-effectselect');
        
        
        
        effectSelect.on("change", function() {
            onChange();
        });
        
        $(".values-input").on("change", function() {
            onChange();
        });
        
        
        sendTo(adapter + "." + instance, 'GetEffectList', null, effectList => {
            for (var entry of effectList) {
                Select_AddOption( effectSelect, entry);
            }

            
            var myOptions = effectSelect[0].options;
        });
        
        

        
        /* the color config can easily be handled with values2table() */
        values2table('table-colors', colorConfig, onChange);
        
        /* handle effect config with own logic */
        timeout = setTimeout(function () {
        
        let ctr = 0;
        $('.config-row').each( function () {
            if (effectConfig[ctr]) {
                thisEffect = effectConfig[ctr];                
                
                $(this).find('td').each (function(index2) {                
                    if (index2==0) {
                        $(this).find("input").val(thisEffect.name);
                    } else if (index2==1) {
                        $(this).find("input").val(thisEffect.prio);
                    } else if (index2==2) {
                        $(this).find("select").each(function () {
                            Select_AddOption( $(this), thisEffect.effect);
                            $(this).val( thisEffect.effect );
                            $(this).select();
                            

                        } );
                        
                        //mySelect = $(this).find("select");
                        
                        
                    }
                } );
            }
            ctr = ctr + 1;
        } );
        
        }, 1000); 

        // reinitialize all the Materialize labels on the page if you are dynamically adding inputs:
        if (M) M.updateTextFields();

    }
    
    function Select_AddOption(select, option) {        
        select.append('<option>' + option + '</option>');
        select.select();
    }
    
    
    


    /* load() is executed by admin adapter everytime the adapter config gui is loaded */
    function save(callback) {
        var adapterConfig = {};

        /* all input values tagged as "cfgval-simple" shall be written to our adapter config */
        $('.cfgval-simple').each(function () {
            var $this = $(this);

            /* actions depend on input type */
            if ($this.attr('type') === 'checkbox') {
                adapterConfig[$this.attr('id')] = $this.prop('checked');
            } else {
                adapterConfig[$this.attr('id')] = $this.val();
            }
        });

        
        
        
        
        /* now add the tables to our config */
        adapterConfig.colors = table2values('table-colors');
        
        tmpArr = [];        
        $('.config-row').each( function (index) {
            
            newObj = {};            
            $(this).find('td').each (function(index) {
                if (index==0) newObj.name = $(this).find("input").val();
                if (index==1) newObj.prio = $(this).find("input").val();
                if (index==2) newObj.effect = $(this).find("select").val();
            } );
            
            if ( (newObj.name) && (newObj.prio) && (newObj.effect) ){
                tmpArr.push( newObj );
                }
        } );
        adapterConfig.effects = tmpArr;
        
        
        sendTo(adapter + "." + instance, 'ConfigSanityCheck', adapterConfig, isSane => {
            if (isSane) {
                /* and finally, give the finished config object to the admin adapter */
                callback(adapterConfig);
            } else {
                $('#dialog_info').modal({
                    startingTop: '4%',
                    endingTop: '10%',
                    dismissible: false
                });

                $('#dialog_info').modal('open');
                Materialize.updateTextFields();
            }
        });
        
        
        
    }
