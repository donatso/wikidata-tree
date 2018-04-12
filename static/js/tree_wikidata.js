class Dtree {
    constructor() {
        this.collapse = this.collapse.bind(this);
        this.click = this.click.bind(this);
        this.zoomed = this.zoomed.bind(this);

        this.treeData = {};
        this.margin = {top: 20, right: 90, bottom: 30, left: 90};
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.svg = d3.select("body").append("svg")
            .attr("width", this.width )
            .attr("height", this.height );
        this.svgGroup = this.svg.append("g");
        this.zoom = d3.zoom()
                .scaleExtent([1 / 2, 8])
                .on("zoom", this.zoomed);
        this.svg
            .call(this.zoom)
            .call(this.zoom.transform, this.transform(this.width/2, this.height/2));

        this.duration = 750;

        this.treeHeight = 0;

    }

    createRoot(){
        this.right_hierarchy = d3.hierarchy(this.treeData, function (d) {
            console.log(d);
            return d.progeny;
        });
        this.left_hierarchy = d3.hierarchy(this.treeData, function (d) {
            return d.ancestry;
        });
        function changeDepth(node) {
            console.log(node)
            if (node.children)
            for (let i = 0; i < node.children.length; i++) {
                node.children[i].depth = -node.children[i].depth;
                if (node.children[i].children){
                    changeDepth(node.children[i])
                }
            }
        }
        changeDepth(this.left_hierarchy);
        // this.right_hierarchy.children = this.right_hierarchy.children.concat(this.left_hierarchy.children)
        return this.right_hierarchy
    }

    calculateTreeHeight() {
        var levelWidth = [1];
        var childCount = function (level, n) {

            if (n.children && n.children.length > 0) {
                if (levelWidth.length <= level + 1) levelWidth.push(0);

                levelWidth[level + 1] += n.children.length;
                n.children.forEach(function (d) {
                    childCount(level + 1, d);
                });
            }

        };
        childCount(0, this.right_hierarchy);
        var newHeight1 = d3.max(levelWidth) * 90; // 70 pixels per line

        levelWidth = [1];
        childCount(0, this.left_hierarchy);
        var newHeight2 = d3.max(levelWidth) * 90; // 70 pixels per line

        return Math.max(newHeight1, newHeight2);

    }



    zoomed(){
        this.svgGroup.attr("transform", d3.event.transform);
    }

    transform(x,y){
        return d3.zoomIdentity
            .translate(x, y)
            // .scale(2);
    }


    collapse(d) {
        var self = this;
        if (d.children) {
            d._children = d.children;
            d._children.forEach(self.collapse);
            d.children = null
        }
    }

    click(d) {

        if (d.data.wiki_id !== this.root.data.wiki_id) {
            this.centerNode(d, true)
        } else {
            this.centerNode(d, false)
            // edit_person_form(this.root.data.wiki_id)
        }
        // if (d.children) {
        //     d._children = d.children;
        //     d.children = null;
        // } else {
        //     d.children = d._children;
        //     d._children = null;
        // }
        // this.update(d);
    }

    findNode(wiki_id){
        for (let i=0;i<this.treeDataMapped.descendants().length;i++){
            if (this.treeDataMapped.descendants()[i].data.wiki_id === wiki_id){
                return this.treeDataMapped.descendants()[i]
            }
        }
    }

    centerNode(source, drawNewTree) {
        let self = this;
        let dur = 600;
        let x = -source.y0 + this.width / 2;
        let y = -source.x0 + this.height / 2;

        if (drawNewTree) {

            this.svg
                 .transition()
                .duration(dur)
                .call(this.zoom.transform, this.transform(x,y))
                .on("end", function () {
                    get_tree(source.data.wiki_id);
                });
            this.svgGroup.selectAll('g.tree_node')
                .transition()
                .duration(dur)
                .style("opacity", function (d) {
                    return d === source ? 1:0
                });

            this.svgGroup.selectAll('path.tree_link')
                .transition()
                .duration(dur)
                .style("opacity", "0");
        } else {
             this.svg
                 .transition()
                .duration(dur)
                .call(this.zoom.transform, this.transform(x,y))
        }
        return source
    }



    drawTree(data) {

        this.treeData = data;
        this.root = this.createRoot();
        this.treeHeight = this.calculateTreeHeight();
        this.root.x0 = this.treeHeight/2;
        this.root.y0 = 0;

        this.treemap = d3.tree().size([this.treeHeight, this.width]);
        this.treeDataMapped = this.mappingTree();

        this.svg
            .call(this.zoom)
            .call(this.zoom.transform, this.transform(this.width/2, this.height/2 - this.treeHeight/2));

        // this.root.children.forEach(this.collapse);
                // Assigns the x and y position for the nodes
        console.log(this.calculateTreeHeight())

        this.update(this.root);
    }

    changeData(data) {
        this.svgGroup.html("").style("opacity", "1");
        this.drawTree(data);
    }

    mappingTree(){
        let treemap = this.treemap(this.left_hierarchy);

        if (this.left_hierarchy.children && this.right_hierarchy.children){
            treemap.children = treemap.children.concat(this.treemap(this.right_hierarchy).children);
        } else if (!this.left_hierarchy.children && this.right_hierarchy.children){
            treemap.children = this.treemap(this.right_hierarchy).children
        }
        for (let i=0; i<treemap.descendants().length; i++){
            if (treemap.descendants()[i].depth === 1){
                treemap.descendants()[i].parent = treemap.descendants()[0]
            }
        }

        return treemap
    }




    update(source) {

        console.log("update start")
        // this.svg.call(this.zoom.transform, this.transform(this.width/2,this.height/2));
        // Compute the new tree layout.
        let nodes = this.treeDataMapped.descendants(),
            links = nodes.slice(1),
            rectW = 150,
            self = this;

        // Normalize for fixed-depth.
        nodes.forEach(function (d) {
            d.y = d.depth * 180;
        });
        nodes.reverse();

        // ****************** Nodes section ***************************

        // Update the nodes...
        let node = this.svgGroup.selectAll('g.tree_node')
            .data(nodes, function (d, i) {
                return d.wiki_id || (d.id = ++i);
            });

        // Enter any new modes at the parent's previous position.
        let nodeEnter = node.enter().append('g')
            .attr('class', 'tree_node')
            .attr("transform", function (d) {
                return "translate(" + source.y0 + "," + source.x0 + ")";
            })
            .on('click', this.click);


        nodeEnter
            .append("rect")
            .attr("x", -rectW/2)
            .attr("y", -21)
            .attr("width", rectW)
            .attr("height", 40)
            .attr("rx", 5)
            .attr("ry", 5)
            .classed("tree_card", true)

        // Add labels for the nodes
         nodeEnter.append("text")
                .each(function (d) {
                    var arr = text_lines(d.data.label);
                    var y;
                    if (arr.length > 1){y = -5}
                    else {y = 2}
                    for (let i = 0; i < arr.length; i++) {
                        d3.select(this).append("tspan")
                            .text(arr[i])
                            .attr("y", y)
                            .attr("dy", i ? "1.2em" : 0)
                            .attr("x", -rectW/2+11)
                            .attr("text-anchor", "start")
                            .attr("class", "tspan" + i)
                    }
                })
             .classed("tree_text", true);

        nodeEnter.append('image')
            .attr("xlink:href", function(d) {
                if (d.data.citation && d.data.citation.length > 0) {
                    return d.data.citation;
                }
                else if (d.data.gender === "f") {
                    return "/static/files/imgs/placeholder-female.png";
                }
                else {
                    return "/static/files/imgs/placeholder.png";
                }
            })
            .attr("x", 39.5)
            .attr("y", -16.2)
            .attr("width", 30)
            .attr("height", 30)
            .attr("preserveAspectRatio", "xMidYMid slice")
            .attr("class", "rukavica")
            .style("border-radius", "5em");


    // var move_x_to = -rectW/2 +22;
    // function move_x(d) {
    //
    //     if(d.depth > 0 ){
    //         return rectW/2 +20
    //     }else if (d.depth < 0) { return move_x_to}
    //     else {return move_x_to}
    // }
    // var addLeftChild = nodeEnter.append("g");
    // addLeftChild.append("rect")
    //   .attr("x", function (d) {
    //       return -30 + move_x(d)
    //   })
    //   .attr("y", -10)
    //   .attr("height", 20)
    //   .attr("width", 20)
    //   .attr("rx", 10)
    //   .attr("ry", 10)
    //     .attr("class", "kartica_button rukavica");
    //
    // addLeftChild.append("line")
    //   .attr("x1", function (d) {
    //       return -25 + move_x(d)
    //   })
    //   .attr("y1", 1)
    //   .attr("x2", function (d) {
    //       return -15 + move_x(d)
    //   })
    //   .attr("y2", 1)
    //   .attr("stroke", "white")
    //   .style("stroke-width", "2");
    //
    // addLeftChild.append("line")
    //   .attr("x1", function (d) {
    //       return -20 + move_x(d)
    //   })
    //   .attr("y1", -4)
    //   .attr("x2", function (d) {
    //       return -20 + move_x(d)
    //   })
    //   .attr("y2", 6)
    //   .attr("stroke", "white")
    //   .style("stroke-width", "2")
    //     .attr("class", "dtree_children_line_up");
    //
    // addLeftChild.style("display", function (d) {
    //     if(d.data.wiki_id !== self.root.data.wiki_id && d.children){return "block"}
    //     else {return "none"}
    // });

        // UPDATE
        let nodeUpdate = nodeEnter.merge(node);

        // Transition to the proper position for the node
        nodeUpdate.transition()
            .duration(this.duration)
            .attr("transform", function (d) {
                return "translate(" + d.y + "," + d.x + ")";
            });


        // Remove any exiting nodes
        let nodeExit = node.exit().transition()
            .duration(this.duration)
            .attr("transform", function (d) {
                return "translate(" + source.y + "," + source.x + ")";
            })
            .remove();

        // On exit reduce the node circles size to 0
        nodeExit.select('circle')
            .attr('r', 1e-6);

        // On exit reduce the opacity of text labels
        nodeExit.select('text')
            .style('fill-opacity', 1e-6);

        // ****************** links section ***************************

        // Update the links...
        let link = this.svgGroup.selectAll('path.tree_link')
            .data(links, function (d) {
                return d.id;
            });

        // Enter any new links at the parent's previous position.
        let linkEnter = link.enter().insert('path', "g")
            .attr("class", "tree_link")
            .attr('d', function (d) {
                let o = {x: source.x0, y: source.y0};
                return diagonal(o, o)
            });

        // UPDATE
        let linkUpdate = linkEnter.merge(link);

        // Transition back to the parent element position
        linkUpdate.transition()
            .duration(this.duration)
            .attr('d', function (d) {
                return diagonal(d, d.parent)
            });

        // Remove any exiting links
        let linkExit = link.exit().transition()
            .duration(this.duration)
            .attr('d', function (d) {
                var o = {x: source.x, y: source.y};
                return diagonal(o, o)
            })
            .remove();

        // Store the old positions for transition.
        nodes.forEach(function (d) {
            d.x0 = d.x;
            d.y0 = d.y;
        });

        // Creates a curved (diagonal) path from parent to the child nodes
        function diagonal(s, d) {

            let path = `M ${s.y} ${s.x}
            C ${(s.y + d.y) / 2} ${s.x},
              ${(s.y + d.y) / 2} ${d.x},
              ${d.y} ${d.x}`;

            return path
        }

        function verticalCentar(d) {
            return -d.x0 + self.height / 2;
        }

        setTimeout(function () {
            // self.centerNode(nodes, false)
            // self.svg.call(self.zoom).call(self.zoom.transform, this.transform(self.width/2, self.height/2));
        }, 1000)

    }

}


function text_lines(text) {
    var text_split = text.split(" ");
    var return_text = [];
    if (text.length > 15) {
        var line_len = 0;
        var second_line_len = 0;
        var first_line_text = "";
        var second_line_text = "";
        for (var i = 0; i < text_split.length; i++) {
            line_len += text_split[i].length;
            if (line_len < 15) {
                first_line_text += text_split[i] + " ";
            } else if (line_len < 25) {
                second_line_text += text_split[i] + " ";
            } else {
                second_line_text += "...";
                break
            }
        }
        return_text = [first_line_text, second_line_text]
    }else {
        return_text = [text]
    }
    return return_text
}

let dtreee = new Dtree();

let initialData = {
            "label": "Top Level",
            "wiki_id": "Q121",
            "progeny": [
                {
                    "label": "Level 2: A",
                    "wiki_id": "Q122",
                    "progeny": [
                        {"label": "Son of A","wiki_id": "Q123",},
                        {"label": "Daughter of A","wiki_id": "Q124",}
                    ]
                },
                {"label": "Level 2: B","wiki_id": "Q125",}
            ],
            "ancestry": [
                {
                    "label": "Level 2: A",
                    "wiki_id": "Q126",
                    "ancestry": [
                        {"label": "Son of A","wiki_id": "Q127",},
                        {"label": "Daughter of A","wiki_id": "Q128",}
                    ]
                },
                {"label": "Level 2: B","wiki_id": "Q129"}
            ]
        };

$("#search").on('keyup', function (e) {
        // if (e.keyCode === 13) {
        //     console.log("start")
        //     $.get("/", {search: $("#search").val()})
        //         .done(function (data) {
        //             console.log(data)
        //             console.log("end")
        //             $("#results").html("")
        //             $.each(data["search"], function (i, d) {
        //                 $("#results").append(
        //                     '<div onclick="get_tree(\'' + d['wiki_id'] + '\')">' + d['label'] + '</div>'
        //                 )
        //             })
        //         })
        // }
});


$(".overlay").fadeOut(300);
function get_tree(p_id) {
    let loader = setTimeout(function () {
        $(".overlay").fadeIn(300);
    }, 500);

    $.get("/", {person: p_id})
        .done(function (data) {
            clearTimeout(loader);
            $(".overlay").fadeOut(300);
            console.log(data)
            dtreee.changeData(data["tree"])
        })
}

$('#search').autocomplete({
    serviceUrl: '/',
    onSelect: function (suggestion) {
        alert('You selected: ' + suggestion.value + ', ' + suggestion.data);
    }
});
var autocomplete_options = {
    lookup: "/",
    minChars: 1,
    params: {
        query: $('#search').val()
    },
    onSelect: function (suggestion) {
        setTimeout(function () {
            get_tree(suggestion.data)
        }, 100);
    }
}

    $('#search').devbridgeAutocomplete(autocomplete_options)
        .on("focus", function () {

        }).on("click", function () {

        }).on("input", function () {

        });

// get Douglas Adams
get_tree("Q42");
