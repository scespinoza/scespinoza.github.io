
let height = 600;
let width = 600;
let res = 15;
let N = height / res;
let M = height / res;

var svg = d3.select("div#grid")
            .append("svg")
            .attr("height", height)
            .attr("width", width);

function buildGrid(N, M, empty=false) {
    let newGrid = new Array(N);
    for (let i = 0; i < N; i++) {
        newGrid[i] = new Array(M);
        for(let j = 0; j < M; j ++) {
            if (empty) {
                newGrid[i][j] = 0;
            } else {
                newGrid[i][j] = Math.floor(Math.random() * 2);
            }
            
        }
    }
    return newGrid;
}



function interface() {
    let gridCoords = [];

    for(let i=0; i < height/res; i++) {
        for(let j = 0; j < width/res; j++){
            gridCoords.push({
                xpos: j,
                ypos: i,
                x: j * res,
                y: i * res,
            });
        }
    }
    cells = svg.selectAll("rect")
        .data(gridCoords)
        .enter()
        .append("g")
        .append("rect")
        .attr("class", "dead")
        .attr("rx", 15)
        .attr("ry", 15)
        .attr("x", function(d){
            return d.x;
        })
        .attr("y", function(d) {
            return d.y;
        })
        .attr("height", res)
        .attr("width", res)
        .on("click", function(d) {
            if (grid[d.ypos][d.xpos] == 1) {
                d3.select(this).attr("class", "dead");
                grid[d.ypos][d.xpos] = 0;
            } else {
                d3.select(this).attr("class", "alive");
                grid[d.ypos][d.xpos] = 1;
            }
        });

    text = d3.selectAll("g")
        .append("text")
        .attr("x", function(d){ return d.x + res/2; })
        .attr("y", function(d){ return d.y + res/2; })
        .attr("display", "none")
        .html(0);
}

function representGrid(grid) {
    neighbors = countNeighbors(grid);
    cells.attr("class", function(d){
        return ["dead", "alive"][ grid[d.ypos][d.xpos] ];
    })
    text
    .html(function(d) {
            return neighbors[d.ypos][d.xpos];
        })
}


function countNeighbors(grid) {
    neighborCounts = buildGrid(N, M, empty=true);

    for(let i = 0; i < N; i++) {
        for(let j = 0; j < M; j++){
            neighborCounts[i][j] = grid[(i - 1 + N) % N][(j - 1 + M) % M] + grid[(i - 1 + N) % N][(j + M) % M] + grid[(i - 1 + N) % N][(j + 1 + M) % M]
                                    + grid[i][(j - 1 + M) % M] + grid[i][(j + 1 + M) % M]
                                    + grid[(i + 1 + N) % N][(j - 1 + M) % M] + grid[(i + 1 + N) % N][(j + M) % M] + grid[(i + 1 + N) % N][(j + 1 + M) % M];
        }
    }

    return neighborCounts;
}

function getNextGrid(grid) {
    let nextGrid = new Array(M);
    for (let i=0; i < N; i++) {
        nextGrid[i] = [...grid[i]];
    }
    neighbors = countNeighbors(grid);
    for(let i=0; i < N; i++) {
        for(let j=0; j < M; j++) {
            if (grid[i][j] == 1) {
                if (neighbors[i][j] < 2 || neighbors[i][j] > 3) {
                    nextGrid[i][j] = 0;
                }
            } else {
                if (neighbors[i][j] == 3) {
                    console.log("new cell!");
                    nextGrid[i][j] = 1;
                }
            }
        }
    }
    return nextGrid;
}



function tick() {
    console.log("newTick");
    let nextGrid = getNextGrid(grid);
    grid = [...nextGrid];
    representGrid(grid);
}


function play() {
    interval = setInterval(tick, 100);
}

function stop() {
    clearInterval(interval);
}



function playController() {
    if (!playing) {
        d3.select("#controller-button")
            .html("STOP")
        playing = true;
        play();
    }
    else {
        d3.select("#controller-button")
            .html("PLAY")
        playing = false;
        stop();
    }
}

function setup (){
    grid = buildGrid(N, M);
    representGrid(grid);
}

function clear() {
    grid = buildGrid(N, M, empty=true);
    representGrid(grid);
}

function loadShape() {
    d3.json("shapes.json").then(function(data) {
        grid = data;
        representGrid(data);
    })    
}

let grid = buildGrid(N, M, empty=true);
let interval;
let playing = false;
let setupDone = false;

interface();