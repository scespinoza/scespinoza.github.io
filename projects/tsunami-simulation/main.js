Array.prototype.last = function() {
    return this[this.length - 1];
}

// Leaflet map load
var map = L.map('map', {
    zoomControl: false
}).setView([-23.645377,-70.4056757], 15);

L.tileLayer('http://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="http://cartodb.com/attributions">CartoDB</a>'
}).addTo(map);


var southWest = L.latLng(-23.763302,-70.5587477),
    northEast = L.latLng(-23.5347237,-70.327345);

var bounds = L.latLngBounds(southWest, northEast);

map.setMaxBounds(bounds);
map.on('drag', function() {
    map.panInsideBounds(bounds, { animate: false });
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

// -- Velocity and Time engine setup --
// A ratio between clock time and simulation time
var simRatio; // sim millieconds / clock milliseconds
function adjustVelocity() {
    document.getElementById("velocityDisplay").innerHTML = 'x' + document.getElementById("simratio-slider").value;
    simRatio = document.getElementById("simratio-slider").value;
    timerWorker.postMessage(["updateRatio", simRatio]);
}

// -- Worker script test --
//Testing if the browser supports workers
if (typeof (Worker) !== "undefined") {
    var timerWorker = new Worker("simTime.js");
} else {
    //  TODO Stop everything because it's not gonna work
    //  as intended.
}

timerWorker.addEventListener("message", function (event) {
    data = event.data;

    if (data[0] === "timerUpdate") {
        $("#timer").html(data[1]);
    }
});


// Loading and displaying safezone delimitation
d3.json('GeoJSONs/safe_zone_antofagasta.geojson').then(function (collection) {

    g.selectAll('path')
        .data(collection.features)
        .enter()
        .append('path')
        .attr('class', 'safezone')
        .attr('d', d3Path);

});

d3.json('GeoJSONs/puntos_encuentro.geojson').then(function(collection) {
    g.selectAll('circle.meeting_point')
                            .data(collection.features)
                            .enter()
                            .append('circle')
                            .attr("r", 7)
                            .attr("class", "meeting_point")
                            .attr('id', function(d) {
                                return 'mp' + d.properties.OBJECTID;
                            })
                            .attr('transform', function(d) {    
                                var p = applyLatLngToLayer(d.geometry.coordinates);
                                return 'translate(' + p.x + ', ' + p.y + ')';
                                })
                            .each(function(d) {
                                d.properties.saved = 0;
                            })
                            .on('click', function (d) {
                                displayMeetingPointInfo(d.properties.OBJECTID);
                            });    
})



function displayMeetingPointInfo(meetingPointID) {
    console.log('Meeting Point: ' + meetingPointID);
    info_saved = g.select('#mp' + meetingPointID).datum().properties.saved;
    console.log('Saved HH: ' + info_saved);
    $("#meeting-point-id").html('Meeting Point ID: ' + meetingPointID);
    $("#saved-counter").html(info_saved + ' Safe Households');
}
/*
    FROM HERE its something i'm trying
*/

// -- Processing workload --
var startTime = new Date;
loadCircleFeatures();
loaded = false;
loadedPaths = {};
loadedShortPaths = [];
circleReferences = [];
var animating = false;

function loadCircleFeatures() {

    function getFeatures(collection, ids) {
        feats = [];
        for (var i = 0; i < ids.length; i++) {
            for (var u = 0; u < collection.features.length; u++) {
                if (collection.features[u].properties.id == ids[i]) {
                    feats.push(collection.features[u]);
                    continue;
                }
            }
        }

        return feats;
    }

function loadingAnimation() { 
    tau = 2 * Math.PI;
    radius = 25;
    width = 100;
    height = 100;
    loading_svg = d3.select('div.loading-slide')
                .append('svg')
                .attr("width", width)
                .attr("height", height)
                .attr("id", "loader-svg")
                .append('g')
                .attr("transform", "translate(" + width / 2 + ", " + height / 2 + ")")
    var arc = d3.arc()
        .innerRadius(radius*0.7)
        .outerRadius(radius*0.9)
        .startAngle(0);

    loading_svg.append("path")
                        .datum({endAngle: 0.33* tau})
                        .style("fill", "white")
                        .attr("d", arc)
                        .call(spin, 1500)
    
    function spin(selection, duration) {
        selection.transition()
            .ease(d3.easeLinear)
            .duration(duration)
            .attrTween("transform", function() {
                return d3.interpolateString("rotate(0)", "rotate(360)");
            });

        setTimeout(function() { spin(selection, duration); }, duration);
    }
}

loadingAnimation();

    // This might be the most efficent way unless we find a way 
    // of saving the file so that we can reference the id right at
    // the begining, like, collection[id].
    d3.json('GeoJSONs/antofa_edges.geojson').then(function (edges) {
        // We need the household ID to 
        d3.json('GeoJSONs/shortest_paths.json').then(function (paths) {

            paths = paths.slice(0, 1000);

            for (var i = 0; i < paths.length; i++) {
                loadedShortPaths.push({
                    householdID: paths[i].id,
                    delay: paths[i].delay,
                    shortestPath: getFeatures(edges, paths[i].shortest_path),
                });
            }
            prepareCircles();
        });

        
        map.on('viewreset', reset);
        reset();
        function reset() {
            var bounds = d3Path.bounds(edges),
                topLeft = bounds[0],
                bottomRight = bounds[1];


            svg.attr('width', bottomRight[0] - topLeft[0])
                .attr('height', bottomRight[1] - topLeft[1])
                .style("left", topLeft[0] + "px")
                .style("top", topLeft[1] + "px");

            g.attr('transform', 'translate(' + -topLeft[0] + ', ' + -topLeft[1] + ')');

            g.selectAll('path.safezone')
                .attr('d', function(d){
                    return d3Path(d.geometry);
                });

            g.selectAll('path.street')
                .attr('d', function(d) {
                    return d3Path(d.geometry);
                })

            g.selectAll('circle.meeting_point')
                .attr('transform', function(d) {
                    var p = applyLatLngToLayer(d.geometry.coordinates);
                    return 'translate(' + p.x + ', ' + p.y + ')';
                });
           
            circleReferences.forEach(function(ref) {
                var circleElement = ref.circle;
                var pathID = ref.id;
                if (circleElement.attr('class') == 'point_static') {
                    circleElement.attr('transform', function() {
                    var p = g.select('path#path_' + pathID).node().getPointAtLength(0);
                    return 'translate(' + p.x + ', ' + p.y + ')';
                    });
                }
            })
            
            
        }
    });
}

function prepareCircles() {


    function getMeetingPoint(shortestPath) {
        var lastPoint = shortestPath.last().geometry.coordinates.last().last();
        var minDist = 999999
        var nearestMeetingPoint;
        g.selectAll('circle.meeting_point').each(function(d) {
            dist = d3.geoDistance(d.geometry.coordinates, lastPoint);
            if (dist <= minDist) {
                nearestMeetingPoint = d.properties.OBJECTID;
                minDist = dist;
            }
        });
        return nearestMeetingPoint;    
    }
    for (var i = 0; i < loadedShortPaths.length; i++) {
        if (loadedShortPaths[i].shortestPath.length == 0) {
            // Remove the empty path and move on
            loadedShortPaths.splice(i, 1);
            continue;
        }

        var Feature = loadedShortPaths[i].shortestPath[0];
        var Id = Feature.properties.id;
    
        if (Id in loadedPaths) {
            loadedPaths[Id] += 1;
            circlePath = d3.select("path#path_" + Id);
        } else {
            var circlePath = g.append('path')
                .datum(Feature)
                .attr('class', 'street')
                .attr('id', 'path_' + Id)
                .attr('d', d3Path);
    
            loadedPaths[Id] = 1;
        }

        meetingPoint = getMeetingPoint(loadedShortPaths[i].shortestPath);
    
        loadedShortPaths[i].shortestPath.shift();

        if (circlePath != null) {
            var newCircle = g.append('circle')
                .attr("class", "point_static")
                .attr('r', 2)
                .attr('transform', function () {
                    var p = circlePath.node().getPointAtLength(0);
                    return 'translate(' + p.x + ', ' + p.y + ')';
                });

            circleReferences.push({
                circle: newCircle, 
                id: Id,
                escapeFeatures: loadedShortPaths[i],
                animating: false,
                endPoint: meetingPoint
            });
        }
    }

    // Done loading!
    delete loadedShortPaths;
    d3.select("#start-button").style("display", "block");
    d3.select(".slidecontainer").style("display", "block");
    d3.select(".loading-text").style("display", "none");
    d3.select(".loading-slide")
        .transition()
        .ease(d3.easeLinear)
        .duration(2000)
        .style("opacity", 0)
        .on("end", function() {
            loaded = true;
            d3.select(this).style("display", "none").remove();
        })

    var nowTime = new Date;
    console.log("Total loading time: " + (nowTime.getTime() - startTime.getTime()) + "ms");
    delete startTime, nowTime;
}

function startAnimations() {
    simRatio = document.getElementById("simratio-slider").value;
    for (var c = 0; c < circleReferences.length; c++) {
        nextCircleAnimation(circleReferences[c]);
    }
    timerWorker.postMessage(["timerInit", simRatio]);
}

function nextCircleAnimation(circleRef) {
    actualPath = d3.select("path#path_" + circleRef.id);

    circleRef.circle.transition()
        .delay(function() {
            if(!circleRef.animating) {
                circleRef.animating = true;
                return circleRef.escapeFeatures.delay / simRatio;
            } else {
                return 0;
            }
        })
        .attr("class", "point_moving")
        .attr("r", 3)
        .duration(0)
        .transition()
        .duration(function () {
            var velocity = 0.0015; // meters per ms
            return actualPath.datum().properties.length / (velocity * simRatio);
        })
        .ease(d3.easeLinear)
        .attrTween("transform", function () {
            return function (t) {
                actualPath = d3.select("path#path_" + circleRef.id);
                pathLength = actualPath.node().getTotalLength();
                p = actualPath.node().getPointAtLength(t * pathLength);
                return 'translate(' + p.x + ', ' + p.y + ')';
            }
        })

        .on("end", function () {
            loadedPaths[circleRef.id] -= 1;
            if (loadedPaths[circleRef.id] <= 0) {
                actualPath.remove();
                delete loadedPaths[circleRef.id];
            }

            result = nextCirclePath(circleRef);
            resultPath = result[0];
            resultId = result[1];

            // If it was not the last
            if (resultPath != null) {
                circleRef.id = resultId;
                nextCircleAnimation(circleRef);
            } else {
                circleRef.circle
                    .transition()
                    .duration(1000)
                    .attr('transform', function(d) {
                        coord = g.select('circle#mp' + circleRef.endPoint).datum().geometry.coordinates;
                        p = applyLatLngToLayer(coord);
                        return 'translate(' + p.x + ', ' + p.y + ')';
                    })
                    .style('fill', 'green')
                    .attr('class', 'end-point')
                    .transition()
                    .duration(3000)
                    .style('opacity', 0)
                    .attr('r', 0)
                    .on('end', function () {
                        g.select('circle#mp' + circleRef.endPoint).datum().properties.saved ++;
                        this.remove();
                        circleReferences.splice(circleReferences.indexOf(circleRef), 1);
                    });
            }
        });
}

function nextCirclePath(circleRef) {
    if(circleRef.escapeFeatures.shortestPath.length == 0){
        return [null, null];
    }
    var Feature = circleRef.escapeFeatures.shortestPath[0];
    var Id = Feature.properties.id;

    if (Id in loadedPaths) {
        loadedPaths[Id] += 1;
        circlePath = d3.select("path#path_" + Id);
        //circlePath.style("opacity", .2*loadedPaths[Id]);
    } else {
        var circlePath = g.append('path')
            .datum(Feature)
            .attr('class', 'street')
            .attr('id', 'path_' + Id)
            .attr('d', d3Path);

        loadedPaths[Id] = 1;
    }

    circleRef.escapeFeatures.shortestPath.shift();
    return [circlePath, Id];
}
