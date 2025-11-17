const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const Product = require("../models/Product");
const { protect, admin } = require("../Middleware/authMiddleware");
const nodemailer = require("nodemailer"); // 1. IMPORT NODEMAILER

// 2. SET UP THE EMAIL TRANSPORTER
// (This is copied from your authRoutes.js)
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// @desc    Create a new order (the "receipt")
// @route   POST /api/orders
// @access  Private (for logged-in users)
router.post("/", protect, async (req, res) => {
  try {
    const { orderItems, shippingAddress, totalPrice } = req.body;

    if (!orderItems || orderItems.length === 0) {
      return res.status(400).json({ message: "No order items" });
    }

    // Create the new order in the database
    const order = new Order({
      user: req.user._id,
      orderItems: orderItems.map(item => ({
        ...item,
        product: item.product, // 'product' is the _id from your cart
      })),
      shippingAddress: shippingAddress,
      totalPrice: totalPrice,
      isPaid: true,
      paidAt: Date.now(),
      status: "Received",
    });

    const createdOrder = await order.save();

    // --- 3. SEND CONFIRMATION EMAIL ---
    try {
      // 3.1 Create the product list HTML
      const itemsHtml = createdOrder.orderItems
  .map(
    (item) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">
          <img 
            src="${item.cartImageUrl}"
            alt="${item.name}" 
            width="60" 
            style="border-radius: 4px; border: 1px solid #eee;"
          />
        </td>

        <td style="padding: 8px; border-bottom: 1px solid #ddd;">
          ${item.name} (x${item.quantity})
        </td>

        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">
          $${((item.price * item.quantity) / 100).toFixed(2)}
        </td>
      </tr>
    `
  )
  .join("");


      // 3.2 Create the full email HTML
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <h2 style="color: #333;">Thank you for your order!</h2>
          <p>Hi ${createdOrder.shippingAddress.name},</p>
          <p>Your order has been received and is now being processed. We'll send you another email when your order has been dispatched.</p>
          
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Order Details</h3>
            <p style="margin: 5px 0;"><strong>Order ID:</strong> ${createdOrder._id}</p>
            <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date(
        createdOrder.createdAt
      ).toLocaleDateString()}</p>
            <p style="margin: 5px 0;"><strong>Total:</strong> <strong style="font-size: 1.1em; color: #000;">$${(
          createdOrder.totalPrice / 100
        ).toFixed(2)} CAD</strong></p>
          </div>
          
          <div style="margin: 20px 0;">
            <h4 style="margin-bottom: 10px;">Shipping To:</h4>
            <p style="margin: 0;">${createdOrder.shippingAddress.name}</p>
            <p style="margin: 0;">${createdOrder.shippingAddress.addressLine1}</p>
            ${createdOrder.shippingAddress.addressLine2 ? `<p style="margin: 0;">${createdOrder.shippingAddress.addressLine2}</p>` : ''}
            <p style="margin: 0;">${createdOrder.shippingAddress.city}, ${createdOrder.shippingAddress.postalCode
        }</p>
            <p style="margin: 0;">${createdOrder.shippingAddress.country}</p>
          </div>
          
          <h4 style="margin-bottom: 10px;">Items Ordered:</h4>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr>
                <th style="padding: 8px; border-bottom: 2px solid #ddd; text-align: left;">Product</th>
                <th style="padding: 8px; border-bottom: 2px solid #ddd; text-align: right;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
            <tfoot>
              <tr>
              <td style="padding-top: 15px; font-weight: bold;"></td>
                <td style="padding-top: 15px; font-weight: bold;">Total</td>
                <td style="padding-top: 15px; text-align: right; font-weight: bold;">$${(
          createdOrder.totalPrice / 100
        ).toFixed(2)} CAD</td>
              </tr>
            </tfoot>
          </table>
          
          <p style="margin-top: 30px; font-size: 0.9em; color: #777;">
            If you have any questions, please reply to this email.
          </p>
          <p style="font-size: 0.9em; color: #777;">- The IRONIC Team</p>
        </div>
      `;

      // 3.3 Send the email
      await transporter.sendMail({
        from: '"IRONIC Store" <' + process.env.EMAIL_USER + '>', // Use your .env email
        to: createdOrder.shippingAddress.email, // Send to the customer's email
        subject: `Your IRONIC Store Order Confirmation (#${createdOrder._id})`,
        html: emailHtml,
      });

      console.log("Confirmation email sent to", createdOrder.shippingAddress.email);
    } catch (emailError) {
      console.error("Error sending confirmation email:", emailError.message);
      // We don't want to stop the order, so we just log the email error
    }
    // --- END OF EMAIL LOGIC ---

    res.status(201).json(createdOrder);
  } catch (error) {
    console.error(error); // This will log the real error
    res.status(500).json({ message: "Server error creating order" });
  }
});

// @desc    Get logged in user's orders
// @route   GET /api/orders/myorders
// @access  Private
router.get("/myorders", protect, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error fetching orders" });
  }
});

// --- ADMIN ROUTES ---

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private/Admin
router.get("/", protect, admin, async (req, res) => {
  try {
    const orders = await Order.find({}).populate("user", "name email").sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error fetching all orders" });
  }
});

// @desc    Update order status (Accepted, Dispatched, etc.)
// @route   PUT /api/orders/:id/status
// @access  Private/Admin

router.put("/:id/status", protect, admin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (order) {
      // --- THIS IS THE NEW LOGIC ---
      // Check if a new status was sent
      if (req.body.status) {
        order.status = req.body.status;
      }

      // Check if a new delivery date was sent
      if (req.body.deliveredAt) {
        order.deliveredAt = req.body.deliveredAt;
      }
      // --- END OF NEW LOGIC ---

      const updatedOrder = await order.save();
      res.json(updatedOrder);
    } else {
      res.status(404).json({ message: "Order not found" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error updating order status" });
  }
});

module.exports = router;





