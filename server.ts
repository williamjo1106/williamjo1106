import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SharedLink {
  id: string;
  url: string;
  title: string;
  authorName: string;
  category: string;
  createdAt: number;
}

const DB_FILE = path.join(process.cwd(), "db.json");

// Initial data structure
let dbData = {
  links: [] as SharedLink[],
  hiddenCategories: [] as string[],
  categoryNames: {
    notice: '공지사항',
    practice1: '실습1',
    practice2: '실습2',
    practice3: '실습3',
  } as Record<string, string>,
  categoryWidths: {
    notice: 320,
    practice1: 320,
    practice2: 320,
    practice3: 320,
  } as Record<string, number>
};

// Load data from file
function loadData() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      dbData = JSON.parse(data);
      console.log("Data loaded from db.json");
    }
  } catch (error) {
    console.error("Failed to load data:", error);
  }
}

// Save data to file
function saveData() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2));
  } catch (error) {
    console.error("Failed to save data:", error);
  }
}

// Initial load
loadData();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/links", (req, res) => {
    res.json(dbData);
  });

  app.post("/api/categories/resize", (req, res) => {
    const { categoryId, width } = req.body;
    if (!categoryId || typeof width !== 'number') return res.status(400).send();
    dbData.categoryWidths[categoryId] = Math.max(200, Math.min(600, width));
    saveData();
    res.json({ categoryWidths: dbData.categoryWidths });
  });

  app.post("/api/categories/rename", (req, res) => {
    const { categoryId, newName } = req.body;
    if (!categoryId || !newName) return res.status(400).send();
    dbData.categoryNames[categoryId] = newName;
    saveData();
    res.json({ categoryNames: dbData.categoryNames });
  });

  app.post("/api/links", (req, res) => {
    const { url, title, authorName, category } = req.body;
    if (!url || !authorName || !category) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const newLink: SharedLink = {
      id: Math.random().toString(36).substring(2, 11),
      url,
      title: title || url,
      authorName,
      category,
      createdAt: Date.now(),
    };

    dbData.links.unshift(newLink);
    saveData();
    res.status(201).json(newLink);
  });

  app.post("/api/categories/toggle-visibility", (req, res) => {
    const { categoryId } = req.body;
    if (!categoryId) return res.status(400).send();

    if (dbData.hiddenCategories.includes(categoryId)) {
      dbData.hiddenCategories = dbData.hiddenCategories.filter(id => id !== categoryId);
    } else {
      dbData.hiddenCategories.push(categoryId);
    }
    saveData();
    res.json({ hiddenCategories: dbData.hiddenCategories });
  });

  app.delete("/api/links/:id", (req, res) => {
    const { id } = req.params;
    dbData.links = dbData.links.filter((link) => link.id !== id);
    saveData();
    res.status(204).send();
  });

  app.delete("/api/categories/:category", (req, res) => {
    const { category } = req.params;
    dbData.links = dbData.links.filter((link) => link.category !== category);
    saveData();
    res.status(204).send();
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
