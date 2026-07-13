import express, { Request, Response } from "express";
import { MongoClient, ServerApiVersion, Collection } from "mongodb";
import dotenv from "dotenv";
import cors from "cors";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
const port = process.env.PORT || 5000;

app.use(express.json());

const uri = process.env.MONGODB_URL; 
app.use(
  cors({
    origin: process.env.CLIENT_URL ,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  })
);

if (!uri) {
  throw new Error("❌ MONGODB_URL is not defined in the .env file");
}

// Product Interface
interface Product {
  name: string;
  price: number;
  description: string;
  image: string;
  category: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// MongoDB Client
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Database & Collection
const productCollection = client
  .db("TrendyHaat")
  .collection<Product>("productsCollection");

// Routes
app.get("/", (req: Request, res: Response) => {
  res.send("🚀 TypeScript Express Server is Running");
});

// Create Product
app.post(
  "/api/products",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const data: Product = req.body;

      const newProduct: Product = {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await productCollection.insertOne(newProduct);
       
      res.status(201).json({
        success: true,
        message: "Product created successfully",
        data: result,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        success: false,
        message: "Failed to create product",
      });
    }
  }
);

// Connect MongoDB
async function connectDB() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });

    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error);
    process.exit(1);
  }
}

connectDB();

// Start Server
app.listen(port, () => {
  console.log(`🚀 Server is running at http://localhost:${port}`);
});