
let outerBounds = {
    type: "FeatureCollection",
    features: [
        {type: "Feature", geometry: { type: "Point", coordinates : [ -74.0638027, -38.154302 ] }},
        {type: "Feature", geometry: { type: "Point", coordinates : [ -71.3861442, -35.5529892 ] }}
    ]

}



d3.json('data/simce_geo_conce.geojson').then( function (collection) {

    var map = L.map('map', {
        zoomControl: false,
        dragging: !L.Browser.mobile
    }).setView([-36.8194261,-73.184521], 11);
    
    L.tileLayer('http://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="http://cartodb.com/attributions">CartoDB</a>'
    }).addTo(map);
    
    
    var southWest = L.latLng(-38.154302,-74.0638027),
        northEast = L.latLng(-35.5529892,-71.3861442);
    
    var mapBounds = L.latLngBounds(southWest, northEast);
    
    map.setMaxBounds(mapBounds);
    map.on('drag', function() {
        map.panInsideBounds(mapBounds, { animate: false });
    });
    // Overlay SVG
    var svg = d3.select(map.getPanes().overlayPane).append("svg");
    var g = svg.append("g").attr("class", "leaflet-zoom-hide");
    
    // Still don't get why you do it this way @Seba
    var transform = d3.geoTransform({
        point: projectPoint
    });
    
    var d3Path = d3.geoPath().projection(transform);
    
    function projectPoint(x, y) {
        var point = map.latLngToLayerPoint(new L.LatLng(y, x));
        this.stream.point(point.x, point.y);
    }

    function applyLatLngToLayer(d) {
        var x = d[0];
        var y = d[1];
    
        return map.latLngToLayerPoint(new L.LatLng(y, x));
    }
    
    var schoolsPoints = g.selectAll('circle')
                .data(collection.features)
                .enter()
                .append("circle")
                .attr("class", function(d) {
                    return d.properties.DEPENDENCI.toLowerCase();
                })
                .attr('r', function(d) {
                    prom = (d.properties.prom_lect4 + d.properties.prom_mate4) / 2
                    return 3*Math.floor(prom / 100);
                })
                .attr('transform', function(d) { 
                    var p = applyLatLngToLayer(d.geometry.coordinates);
                    return 'translate(' + p.x + ', ' + p.y + ')'
                })
                .on("click", function(d) {
                    d3.select("#nombre-establecimiento")
                        .html(d.properties.NOMBRE_RBD);
                    d3.select("#puntaje-matematica")
                        .html("Puntaje Matemáticas: " + d.properties.prom_mate4);
                    d3.select("#puntaje-lenguaje")
                        .html("Puntaje Lenguaje: " + d.properties.prom_lect4);
                })

    map.on('viewreset', reset);
    map.on('zoom', reset);
    reset();
    function reset() {
        var bounds = d3Path.bounds(outerBounds);
        var topLeft = bounds[0];
        var bottomRight = bounds[1];
    
        svg.attr('width', bottomRight[0] - topLeft[0])
            .attr('height', bottomRight[1] - topLeft[1])
            .style("left", topLeft[0]+ "px")
            .style("top", topLeft[1]+ "px");
    
        g.attr('transform', 'translate(' + -topLeft[0] + ', ' + -topLeft[1] + ')');
    
        
        g.selectAll('circle')
            .attr('transform', function(d) {
                var p = applyLatLngToLayer(d.geometry.coordinates);
                return 'translate(' + p.x + ', ' + p.y + ')';
            });

        }        
      
})

        