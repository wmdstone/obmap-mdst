import { useState, useEffect } from "react";

interface ThemeColors {
  primary: string;
  accent: string;
  background: string;
  foreground: string;
  nodeGlow: string;
  linkColor: string;
  canvasBackground: string;
  folderNodeColor: string;
  fileNodeColor: string;
}

interface PhysicsSettings {
  chargeStrength: number;
  linkDistance: number;
  velocityDecay: number;
  alphaDecay: number;
}

interface Theme {
  colors: ThemeColors;
  physics: PhysicsSettings;
}

const defaultTheme: Theme = {
  colors: {
    primary: "270 70% 65%",
    accent: "270 80% 70%",
    background: "240 15% 5%",
    foreground: "240 10% 95%",
    nodeGlow: "270 80% 70%",
    linkColor: "270 70% 65%",
    canvasBackground: "240 15% 8%",
    folderNodeColor: "48 100% 60%",
    fileNodeColor: "270 70% 65%",
  },
  physics: {
    chargeStrength: -300,
    linkDistance: 100,
    velocityDecay: 0.3,
    alphaDecay: 0.02,
  },
};

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("app-theme");
    if (!saved) return defaultTheme;
    
    try {
      const parsed = JSON.parse(saved);
      
      // Check if it's the old format (properties directly on theme)
      if (parsed.primary && !parsed.colors) {
        // Migrate old format to new format
        return {
          colors: {
            primary: parsed.primary || defaultTheme.colors.primary,
            accent: parsed.accent || defaultTheme.colors.accent,
            background: parsed.background || defaultTheme.colors.background,
            foreground: parsed.foreground || defaultTheme.colors.foreground,
            nodeGlow: parsed.nodeGlow || defaultTheme.colors.nodeGlow,
            linkColor: parsed.linkColor || defaultTheme.colors.linkColor,
            canvasBackground: defaultTheme.colors.canvasBackground,
            folderNodeColor: defaultTheme.colors.folderNodeColor,
            fileNodeColor: defaultTheme.colors.fileNodeColor,
          },
          physics: defaultTheme.physics,
        };
      }
      
      // If it's new format but missing properties, merge with defaults
      return {
        colors: { ...defaultTheme.colors, ...parsed.colors },
        physics: { ...defaultTheme.physics, ...parsed.physics },
      };
    } catch (e) {
      console.error("Failed to parse theme from localStorage", e);
      return defaultTheme;
    }
  });

  useEffect(() => {
    // Apply theme colors to CSS variables
    const root = document.documentElement;
    root.style.setProperty("--primary", theme.colors.primary);
    root.style.setProperty("--accent", theme.colors.accent);
    root.style.setProperty("--background", theme.colors.background);
    root.style.setProperty("--foreground", theme.colors.foreground);
    root.style.setProperty("--node-glow", theme.colors.nodeGlow);
    root.style.setProperty("--ring", theme.colors.primary);
    root.style.setProperty("--sidebar-primary", theme.colors.primary);
    root.style.setProperty("--sidebar-ring", theme.colors.primary);
    root.style.setProperty("--canvas-bg", theme.colors.canvasBackground);
    root.style.setProperty("--folder-node", theme.colors.folderNodeColor);
    root.style.setProperty("--file-node", theme.colors.fileNodeColor);
    
    // Save to localStorage
    localStorage.setItem("app-theme", JSON.stringify(theme));
  }, [theme]);

  const updateColor = (key: keyof ThemeColors, value: string) => {
    setTheme((prev) => ({ 
      ...prev, 
      colors: { ...prev.colors, [key]: value } 
    }));
  };

  const updatePhysics = (key: keyof PhysicsSettings, value: number) => {
    setTheme((prev) => ({ 
      ...prev, 
      physics: { ...prev.physics, [key]: value } 
    }));
  };

  const resetTheme = () => {
    setTheme(defaultTheme);
  };

  return { theme, updateColor, updatePhysics, resetTheme };
};
