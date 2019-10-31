
let height = 600;
let width = 600;
let res = 20;

var svg = d3.select("div#grid")
            .append("svg")
            .attr("height", height)
            .attr("width", width);

let grid = [];

for(let i=0; i < height/res; i++) {
    for(let j = 0; j < width/res; j++){
        grid.push({
            x: i * res,
            y: j * res,
        });
    }
}


cells = svg.selectAll("rect")
        .data(grid)
        .enter()
        .append("rect")
        .attr("class", "dead")
        .attr("rx", 4)
        .attr("ry", 4)
        .attr("x", function(d){
            return d.x;
        })
        .attr("y", function(d) {
            return d.y;
        })
        .attr("height", res)
        .attr("width", res);

function setup() {
    cells.transition()
        .duration(1000)
        .attr("class", function() {
            return ["alive", "dead"][Math.floor(Math.random() * 2)];
        })
}
