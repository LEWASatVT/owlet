(function(){
    'use strict';

    var hosturl = 'http://lewaspedia.enge.vt.edu:8080';

    /* the DOM select string that should identify the <select> element
     * containing the metric options */
    var metricSelector ='#metric_dropdown';

    var series = [ {
        color: 'steelblue',
        data: [ ]
    }];

    var graph = new Rickshaw.Graph( {
        element: document.querySelector('#chart'),
        width: 580,
        height: 250,
        renderer: 'bar',
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
        plotTimeSeries: function(timeseries,  name, graph) {
            var data = owlet.timeseriesToRickshaw(timeseries);
            series[0] = { name: name, data: data, color: 'lightblue' };
            graph.update();
        }
    };
    
    var leapi = {              
        loadMetricList: function(el, select) {
            jQuery.get(hosturl + '/metrics', function ( response ) {
                var options = $(el);
                $.each(response, function() {
                    options.append($('<option />').val(this.id).text(this.medium + ' ' + this.name));
                });
                select = typeof select !== 'undefined' ? select : false;
                if(select) {
                    $(metricSelector + ' option:contains("' +  select +'")').prop('selected',true).change();
                }
                } );
        },
        loadTimeSeries: function(metric, name, graph) {
            var dataUrl = hosturl + '/stroubles1/timeseries?metric.id=' + metric;
            jQuery.get(dataUrl, function( response ) {
                owlet.plotTimeSeries(response, name, graph);
            });
        },
        onReady: function() {
            leapi.loadMetricList(metricSelector, 'temperature');
            $(metricSelector).change(function() {
                $('option:selected').each(function() {
                    leapi.loadTimeSeries($( this ).val(), $( this ).text(), graph);
                });
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
