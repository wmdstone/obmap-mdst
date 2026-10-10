# Architecture rules

- GraphBottomOverlays owns the shared MiniMap/Levels toolbar and overlay lifecycle; GraphMiniMap and GraphLevelLegend render panel content only, keeping overlay state out of GraphCanvas and preventing in-flow toolbar expansion.