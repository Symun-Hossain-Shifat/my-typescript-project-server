import express, { Request, Response, NextFunction } from "express";
import { MongoClient, ServerApiVersion, ObjectId } from "mongodb";
import dotenv from "dotenv";
import cors from "cors";
import { createRemoteJWKSet, jwtVerify } from "jose-cjs";


dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

const uri = process.env.MONGODB_URL; 

app.use(express.json());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  })
);

if (!uri) {
  throw new Error("❌ MONGODB_URL is not defined in the .env file");
}

// const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "default_secret_key_if_missing");
const JWKS = createRemoteJWKSet(
  new URL("http://localhost:3000/api/auth/jwks")
);
// Product Interface
interface Product {
  name: string;
  price: number;
  description: string;
  image: string;
  category: string;
  authoremail?: string;
  createdAt?: Date;
  updatedAt?: Date;
} 

// Custom Request Type
interface CustomRequest extends Request {
  user?: {
    id: string;
    name: string;
    email: string;
    role: "Admin" | "User" | string;
    [key: string]: any;
  };
}

// MongoDB Client Setup
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Database & Collection References
const productCollection = client.db("TrendyHaat").collection<Product>("productsCollection");
const userCollection = client.db("TrendyHaat").collection<any>("user"); // FIX: প্রপার গ্লোবাল ভেরিয়েবল

// 1. VerifyToken Middleware
const VerifyToken = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  const authHeader = req.headers.authorization;
  const id = req.headers.user;

  if (!authHeader || typeof authHeader !== "string") {
    return res.status(401).send({ message: "Unauthorized access: Missing Header" });
  } 

  const Token = authHeader.split(' ')[1]; 
  if (!Token) {
    return res.status(401).send({ message: "Unauthorized access: Missing Token" });
  } 

 try {
 const { payload } = await jwtVerify(Token, JWKS);
  console.log("Token Payload Verified:", payload);
} catch (error) {
  console.error("JWT Verify Error:", error);
  return res.status(403).send({
    message: "Forbidden: Invalid Token",
    error: error instanceof Error ? error.message : error,
  });
}
   
  if (!id || typeof id !== "string") {
    return res.status(400).send({ message: "Invalid or missing User ID in headers" });
  }

  try {
    const UserId = new ObjectId(id);
    
    const user = await userCollection.findOne({ _id: UserId });
    
    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role || "User",
    };
    next();
  } catch (error) {
    return res.status(400).send({ message: "Invalid Object ID format" });
  }
};


export const VerifyAdmin = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  const user = req.user;
  if (user?.role !== 'Admin') {
    return res.status(403).send({ message: 'forbidden access: Admin role required' });
  }
  next();
};


export const VerifyUser = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  const user = req.user;
  if (user?.role !== 'User') {
    return res.status(403).send({ message: 'forbidden access: User role required' });
  }
  next();
};

// Base Route
app.get("/", (req: Request, res: Response) => {
  res.send("🚀 TypeScript Express Server is Running Perfectly");
});

// Get Products API
app.get("/api/products", async (req: Request, res: Response) => {
  try {
    const { id, authoremail } = req.query;

    if (authoremail) {
      const emailStr = authoremail as string;
      const products = await productCollection.find({ authoremail: emailStr }).toArray();
      return res.status(200).json({ success: true, data: products });
    }

    if (id) {
      const productId = id as string;
      if (!ObjectId.isValid(productId)) {
        return res.status(400).json({ success: false, message: "Invalid product ID format" });
      }
      const product = await productCollection.findOne({ _id: new ObjectId(productId) });
      if (!product) {
        return res.status(404).json({ success: false, message: "Product not found" });
      }
      return res.status(200).json({ success: true, data: product });
    }

    const allProducts = await productCollection.find().toArray();
    return res.status(200).json({ success: true, data: allProducts });
    
  } catch (error) {
    console.error("Products API Error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

// Delete Product API 
app.delete(
  "/api/products/:id", VerifyToken, VerifyAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string; 
      if (!ObjectId.isValid(id)) {
        res.status(400).send({ success: false, message: "Invalid ID format" });
        return;
      }

      const result = await productCollection.deleteOne({ _id: new ObjectId(id) });
      if (result.deletedCount === 0) {
        res.status(404).send({ success: false, message: "Product not found in database" });
        return;
      }
      res.send({ success: true, deletedCount: result.deletedCount });
    } catch (error: any) {
      console.error("Server Delete Error:", error); 
      res.status(500).send({ success: false, message: error.message || "Internal Server Error" });
    }
  }
);

// Patch Product API
app.patch(
  "/api/products/:id", VerifyToken, VerifyAdmin,
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

      const result = await productCollection.updateOne({ _id: id }, newdata);
      if (result.matchedCount === 0) {
        res.status(404).send({ success: false, message: "Product not found" });
        return;
      }
      res.json({ success: true, result });
    } catch (error: any) {
      console.error("PATCH error:", error);
      res.status(500).send({ success: false, message: error.message || "Internal Server Error" });
    }
  }
);

// Create Product API
app.post(
  "/api/products", VerifyToken, VerifyUser, 
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
      res.status(500).json({ success: false, message: "Failed to create product" });
    }
  }
);

// Connect MongoDB & Start Server
async function connectDB() {
  try {
    await client.connect();
   
    console.log("✅ Connected to MongoDB");
    
    app.listen(port, () => {
      console.log(`🚀 Server is running at http://localhost:${port}`);
    });
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error);
    process.exit(1);
  }
}

connectDB();