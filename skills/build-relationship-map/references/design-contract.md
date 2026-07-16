# Relationship Map Design Contract

## Content schema

- Stable node IDs and display labels.
- Directed or undirected edges with an explicit type.
- A fixed legend mapping color, line style, and arrowhead to meaning.
- Optional clusters with explicit membership.
- One narrative focus relationship per page.

## Visual language

Use restrained editorial vector design on a calm ivory ground. Nodes share one frame system. Clusters use soft containment fields. Edge types use a fixed semantic set. Prefer curved perimeter routing and generous whitespace over central crisscrossing. A small legend must be readable without competing with the map.

## Reject when

- Any node, edge, direction, type, or cluster differs from the structured input.
- An edge crosses a label or runs through a node.
- The central area becomes a line hairball.
- Legend colors or line styles do not match edges.
- The page cannot be read in two seconds at phone size.
- A visually minor consumer, legend, or feedback edge crosses the 82% content boundary; every graph element counts as important content.

## Repair map

- Hairball: split into overview and cluster pages; reduce overview edges to the focus set.
- Crossing labels: reroute along margins or reposition nodes before changing typography.
- Semantic uncertainty: remove the uncertain edge; never decorate with invented relationships.

## Forward-test brief

Create a 9:16 relationship map titled “一杯咖啡的价值链”. Nodes: 咖农, 处理站, 烘焙商, 咖啡店, 消费者. Directed “产品流” edges: 咖农→处理站→烘焙商→咖啡店→消费者. Directed “信息反馈” edges: 消费者→咖啡店→烘焙商. Put 咖农+处理站 in cluster “产地”, 烘焙商+咖啡店 in “市场”. Highlight 咖啡店→烘焙商 feedback. No other edges. Keep the lower 18% empty.
