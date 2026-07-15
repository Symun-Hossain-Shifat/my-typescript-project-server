import express, { Request, Response } from "express";
import { MongoClient, ServerApiVersion, Collection, ObjectId } from "mongodb";
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



app.get("/api/products", async (req: Request, res: Response) => {
  try {
    const { id } = req.query;

    // Get single product by ID
    if (id) {
      const productId = id as string;

      if (!ObjectId.isValid(productId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid product ID",
        });
      }

      const product = await productCollection.findOne({
        _id: new ObjectId(productId),
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: product,
      });
    }

    // Get all products
    const products = await productCollection.find().toArray();

    return res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error("Products API Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});


// Delete api 
app.delete(
  "/api/products/:id",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string; 

      
      if (!ObjectId.isValid(id)) {
        res.status(400).send({ success: false, message: "Invalid ID format" });
        return;
      }

     
      const result = await productCollection.deleteOne({
        _id: new ObjectId(id) 
      });

     
      if (result.deletedCount === 0) {
        res.status(404).send({ success: false, message: "Product not found in database" });
        return;
      }

    
      res.send({ success: true, deletedCount: result.deletedCount });
      
    } catch (error: any) {
      
      console.error("Server Delete Error:", error); 
      
      res.status(500).send({ 
        success: false, 
        message: error.message || "Internal Server Error" 
      });
    }
  }
);

// Patch api 
app.patch(
  "/api/products/:id",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const idStr = req.params.id as string;

      
      if (!ObjectId.isValid(idStr)) {
        res.status(400).send({ success: false, message: "Invalid Product ID format" });
        return;
      }

      const id = new ObjectId(idStr);
      const Data = req.body;

      
      const newdata = {
        $set: {
          title: Data.title,
          category: Data.category,
          shortDescription: Data.shortDescription,
          description: Data.description,
          price: Data.price,
          image: Data.image,
          updatedAt: new Date() 
        },
      };

      const result = await productCollection.updateOne(
        { _id: id },
        newdata
      );

      if (result.matchedCount === 0) {
        res.status(404).send({ success: false, message: "Product not found" });
        return;
      }

      res.json({ success: true, result });
    } catch (error: any) {
      console.error("PATCH error:", error);
      res.status(500).send({ 
        success: false, 
        message: error.message || "Internal Server Error" 
      });
    }
  }
);

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