/*owlet = function(){
    var init = function(baseurl) {
    }
    return{init:init};
}();
// */

(function(){
    'use strict';

    var hosturl = 'http://lewaspedia.enge.vt.edu:8080';
    var siteId = 'stroubles1';
    
    /* the DOM select string that should identify the <select> element
     * containing the metric options */
    var metricSelector ='#metric_dropdown';

    var series = [
        {
            color: 'steelblue',
            data: [ ],
            renderer: 'bar'
        },
        {
            data: [ ],
            renderer: 'scatterplot'
        }
    ];

    var graph = new Rickshaw.Graph( {
        element: document.querySelector('#chart'),
        width: 580,
        height: 250,
        renderer: 'multi',
        dotSize: 2,
        series: series
    } );

    var format = function(d) {
        d = new Date(d * 1000);
        return d3.time.format('%a %H:%M')(d);
    };
    
    var xAxis = new Rickshaw.Graph.Axis.X({
        graph: graph,
        tickFormat: format
    });

    xAxis.render();

    var yAxis = new Rickshaw.Graph.Axis.Y( {
        graph: graph,
        orientation: 'left',
        tickFormat: Rickshaw.Fixtures.Number.formatKMBT,
        element: document.getElementById('y_axis')
    } );

    yAxis.render();
    
    new Rickshaw.Graph.HoverDetail({
        graph: graph/*,
        formatter: function(series, x, y) {
            var date = '<span class="date">' + new Date(x * 1000).toUTCString() + '</span>';
            var swatch = '<span class="detail_swatch" style="background-color: ' + series.color + '"></span>';
            var content = swatch + series.name + ': ' + parseFloat(y) + '<br>' + date;
            return content;
        }*/
    });

    graph.render();
    
    var owlet = {
        timeseriesToRickshaw: function(timeseries) {
            return $.map(timeseries.data.reverse(), function(d) {
                var date = new Date(d[1]);
                /* Rickshaw uses seconds since 1970-01-01, .getTime()
                 * returns milliseconds */
                return { x: date.getTime()/1000, y: d[0] };
            });
        },
        /* jshint devel:true */
        plotTimeSeries: function(timeseries,  name, graph) {
            var palette = new Rickshaw.Color.Palette();
            series.length = 0;
            var units = [];
            if (timeseries.constructor === Array) {
                // pass
                _.each(timeseries, function (ts) {
                    var myUnits = ts._embedded.units;
                    var data = owlet.timeseriesToRickshaw(ts);
                    series.push( { name:name + ts._embedded.instrument.name + ' (' + myUnits.abbv + ')',
                                   data: data, color: palette.color(), renderer: 'scatterplot'
                                 } );
                    units.push(myUnits);
                });
            } else {
                var myUnits = timeseries._embedded.units;
                var data = owlet.timeseriesToRickshaw(timeseries);
                series[0] = { name:name + timeseries._embedded.instrument.name + ' (' + myUnits.abbv + ')',
                              data: data, color: 'lightblue', renderer: 'bar'
                            };
                units.push(myUnits);
            }
            $('#y_label').text(units[0].name + ' (' + units[0].abbv + ')');
            graph.update();    
        }
    };
    var leapi = {              
        /* jshint devel:true */
        metrics: [],
        loadMetricList: function(el, selected) {
            /*jQuery.get(hosturl + '/sites/' + siteId + '/metrics', function ( response ) {*/

            jQuery.get(hosturl + '/sites/' + siteId + '/metricgroups', function (response) {
                _.each(response, function(element) {
                    leapi.metrics.push.apply(leapi.metrics, element._embedded.metrics);
                });

                var selectEl = $(el);
                /* selectedId is always a number, see
                 * http://stackoverflow.com/questions/3546900/jquery-get-text-as-number */
                var selectedId = +(selectEl.select('option:selected').val());
                
                selectEl.children().remove();
                _.chain(leapi.metrics)
                    /*.filter(function(item) { return item.observationCount > 1; })*/
                    .sortBy( function(a) { return a.medium; } )
                    .each( function(item) {
                        /*console.log('metric id ' + item.id + ' has timeseries ' + item._links.timeseries.href);*/
                        var optionEl = $('<option />').val(item.id).text(item.medium + ' ' + item.name);
                        if (item.id === selectedId) {
                            optionEl.prop('selected',true);
                        }
                        selectEl.append(optionEl);
                    });

                selected = typeof(selected) !== 'undefined' ? selected : false;
                if(selected) {
                    selectEl.select('option:contains("' +  selected +'")').prop('selected',true).change();
                }
            });
        },
        loadTimeSeries: function(params, graph) {
            var since  = new Date(params.since);
            var metric = leapi.metrics.find(function(element)
                                            {
                                                return parseInt(element.id) === parseInt(params.what.id);
                                            }); 
            var dataUrl = hosturl + metric._links.timeseries.href + '?since=' + since.toISOString();
            jQuery.get(dataUrl, function( response ) {
                owlet.plotTimeSeries(response, name, graph);
            });
        },
        getParams: function() {
            var what;
            var since;
            $(metricSelector + ' option:selected').each(function() {
                what = { id: $( this ).val(), name: $( this ).text() };
            });

            since = $( '#datepicker' ).val();
            return { what:what, since:since };
        },
        dateToString: function(d) {
            return (d.getMonth()+1) + '/' + d.getDate() + '/' + d.getUTCFullYear();

        },
        onReady: function() {
            leapi.loadMetricList(metricSelector, 'temperature');
            $(metricSelector).change(function() {
                $('option:selected').each(function() {
                    var params = leapi.getParams();
                    leapi.loadTimeSeries(params, graph);
                });
            });

            var today = new Date();
            var yesterday = new Date();
            yesterday.setDate(today.getDate() - 1);
            var tdate = leapi.dateToString(yesterday);
            $( '#datepicker' ).datepicker();
            $( '#datepicker' ).datepicker('setDate', tdate);
            $( '#datepicker' ).change(function() {
                var date = new Date($( this ).val());
                if (date > today) {
                    $( '#datepicker' ).datepicker('setDate', leapi.dateToString(today));
                }
               
                var params = leapi.getParams();
                leapi.loadTimeSeries(params, graph);
            });
            /* refresh data for selected metric every 30 seconds */
            /* TODO: set refresh time based on refresh time of metric
               from API */
            setInterval( function() {
                $(metricSelector + ' option:selected').change();                
                graph.update();                
            }, 30000 );
            /* check for new metrics every 5 minutes */
            setInterval( function() {
                leapi.loadMetricList(metricSelector);
            }, 300000 );
        }

    };
    
    $( document ).ready( leapi.onReady() );

})();
