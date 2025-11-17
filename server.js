require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const stripe = require("stripe")(process.env.STRIPE_SECRET);

const app = express();

// ✅ Import routes
const authRoutes = require("./Routes/authRoutes");
const productRoutes = require("./Routes/productRoutes");
const userRoutes = require("./Routes/userRoutes"); 
const orderRoutes = require("./Routes/orderRoutes");

// ✅ Middlewares
app.use(express.json());
app.use(cors({ origin: "https://ironic-gym-frontend.vercel.app", credentials: true }));
// ✅ MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ✅ Stripe checkout
app.post("/api/create-checkout-session", async (req, res) => {
  try {
    const { products } = req.body;

    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: "No products provided." });
    }

    const lineItems = products.map((product) => ({
      price_data: {
        currency: "cad",
        product_data: {
          name: product.name,
          images: product.image ? [product.image] : [],
        },
        // 👇 --- IMPORTANT FIX ---
        // Stripe requires the price in CENTS.
        // This converts your price (e.g., 2999) to cents (299900).
       unit_amount: product.price,
      },
      quantity: product.quantity,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: "https://ironic-gym-frontend.vercel.app/success",
      cancel_url: "https://ironic-gym-frontend.vercel.app/cancel",
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Stripe session creation failed:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/users", userRoutes); 
app.use("/api/orders", orderRoutes);

app.get("/", (req, res) => res.send("Gym clothing backend running..."));

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));