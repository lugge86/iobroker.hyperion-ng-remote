    
var colorConfig = [];
var effectConfig = [];
var backend = adapter + "." + instance;

/* function is called by admin adapter and is responsible for setting up all widgets with user config */
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

    /* get color and effect config from config object, otherwise, create empty objects */
    colorConfig = settings.colors || [];
    effectConfig = settings.effects || [];
    
    
    /* when a select field or input field has changed, save button shall be available */
    effectSelect = $('.hng-config-value-effectselect');
    effectSelect.on("change", function() {
        onChange();
    });    
    $(".values-input").on("change", function() {
        onChange();
    });
    
    
    /* ask the adapter backend which effects are provided by server and add them to the select fields */
    sendTo(backend, 'GetEffectList', null, effectList => {
        for (var entry of effectList) {
            Select_AddOption( effectSelect, entry);
        }
        var myOptions = effectSelect[0].options;
    });
    
    
    /* the color config can easily be handled with values2table() */
    values2table('table-colors', colorConfig, onChange);
    
    /* the effect config is a little more complicated and requires own logic */
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
                }
            } );
        }
        ctr = ctr + 1;
    } );    
    }, 1000); 

    /* re-initialize labels */
    if (M) M.updateTextFields();
    
    /* save button is greyed out at the beginning */
    onChange(false);
}


/* function is called by admin adapter and is responsible for saving all user config */
function save(callback) {
    
    /* create object for holding the user config */
    var adapterConfig = {};

    /* all input values tagged as "cfgval-simple" can directly be stored in our config object */
    $('.cfgval-simple').each(function () {
        var $this = $(this);

        /* checkboxes need further treatment */
        if ($this.attr('type') === 'checkbox') {
            adapterConfig[$this.attr('id')] = $this.prop('checked');
        } else {
            adapterConfig[$this.attr('id')] = $this.val();
        }
    });
    
    /* now add the color table to our config */
    adapterConfig.colors = table2values('table-colors');
    
    /* the effects table is a little more complicated */
    tmpArr = [];        
    $('.config-row').each( function (index) {
        
        newObj = {};            
        $(this).find('td').each (function(index) {
            if (index==0) newObj.name = $(this).find("input").val();
            if (index==1) newObj.prio = $(this).find("input").val();
            if (index==2) newObj.effect = $(this).find("select").val();
        } );
        
        /* check that no field is empty */
        if ( (newObj.name) && (newObj.prio) && (newObj.effect) ){
            tmpArr.push( newObj );
        }
    });
    adapterConfig.effects = tmpArr;
    
    
    /* before storing the config object via the callback, ask adapter backend if the config is valid */
    sendTo(backend, 'ConfigSanityCheck', adapterConfig, isSane => {
        if (isSane) {
            /* config object is valid and can be stored permanently */
            callback(adapterConfig);
        } else {
            /* show error dialog */
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


/* function adds a new element to a select field */
function Select_AddOption(select, option) {        
    select.append('<option>' + option + '</option>');
    select.select();
}
