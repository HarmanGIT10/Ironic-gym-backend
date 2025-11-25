const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const { protect, admin } = require("../Middleware/authMiddleware");
const { Resend } = require("resend"); 

// 2. SET UP THE EMAIL TRANSPORTER
// (This is copied from your authRoutes.js)
const resend = new Resend(process.env.RESEND_API_KEY);

router.post("/", protect, async (req, res) => {
  try {
    const { orderItems, shippingAddress, totalPrice } = req.body;

    if (!orderItems || orderItems.length === 0) {
      return res.status(400).json({ message: "No order items" });
    }

    // 1. UPDATE STOCK QUANTITY
    for (const item of orderItems) {
      const product = await Product.findById(item.product);
      if (product) {
        product.quantity = product.quantity - item.quantity;
        await product.save();
      }
    }

    // --- HELPER FUNCTION FOR IMAGES ---
    const formatGitHubUrl = (url) => {
      if (url && url.includes("github.com") && url.includes("/blob/")) {
        return url
          .replace("github.com", "raw.githubusercontent.com")
          .replace("/blob/", "/")
          .split("?")[0];
      }
      return url;
    };

    // 2. SAVE ORDER TO DB
    const order = new Order({
      user: req.user._id,
      orderItems: orderItems.map((item) => ({
        ...item,
        product: item.product,
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
        .map((item) => {
          // ✅ FIX: Calculate the image URL INSIDE the loop for each specific item
          const emailImage = formatGitHubUrl(item.cartImageUrl);

          return `
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">
                <img 
                  src="${emailImage}" 
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
          `;
        })
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
     await resend.emails.send({
  from: "IRONIC Store <noreply@ironicgym.com>",
  to: createdOrder.shippingAddress.email,
  subject: `Your IRONIC Store Order Confirmation (#${createdOrder._id})`,
  html: emailHtml,
});


      console.log("Confirmation email sent to", createdOrder.shippingAddress.email);
      // ... (after the code that sends email to customer) ...

      // --- 4. SEND NOTIFICATION TO ADMINS ---
      // Find all users who are admins
      const adminUsers = await User.find({ isAdmin: true });
      
      // Extract their emails into a list
      const adminEmails = adminUsers.map((user) => user.email);

      // Send the email if admins exist
      if (adminEmails.length > 0) {const adminEmailHtml = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
            
            <!-- Dark Header -->
            <div style="background-color: #1a1a1a; padding: 20px; text-align: center;">
              <h2 style="color: #4ade80; margin: 0; font-size: 24px;">🚀 New Order Received</h2>
              <p style="color: #cccccc; margin: 5px 0 0 0; font-size: 14px;">Order #${createdOrder._id}</p>
            </div>

            <div style="padding: 25px; background-color: #ffffff;">
              <p style="font-size: 16px; color: #333;">Hello Team,</p>
              <p style="color: #555;">A new order has just been placed. Here is the summary:</p>

              <!-- Revenue Card -->
              <div style="display: flex; justify-content: space-between; background: #f0fdf4; padding: 15px; border: 1px solid #bbf7d0; border-radius: 6px; margin: 20px 0;">
                <div>
                   <p style="margin: 0; font-size: 12px; color: #166534; text-transform: uppercase; font-weight: bold;">Total Revenue</p>
                   <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: bold; color: #15803d;">$${(createdOrder.totalPrice / 100).toFixed(2)} CAD</p>
                </div>
                <div style="text-align: right;">
                   <p style="margin: 0; font-size: 12px; color: #166534; text-transform: uppercase; font-weight: bold;">Customer</p>
                   <p style="margin: 5px 0 0 0; font-size: 16px; color: #15803d;">${createdOrder.shippingAddress.name}</p>
                </div>
              </div>

              <!-- Shipping Details Box -->
              <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; border: 1px solid #e5e7eb; margin-bottom: 20px;">
                <h4 style="margin-top: 0; color: #374151; border-bottom: 1px solid #ddd; padding-bottom: 8px;">📍 Shipping Destination</h4>
                <p style="margin: 5px 0; font-size: 14px; color: #4b5563;">
                  ${createdOrder.shippingAddress.addressLine1}<br>
                  ${createdOrder.shippingAddress.addressLine2 ? createdOrder.shippingAddress.addressLine2 + '<br>' : ''}
                  ${createdOrder.shippingAddress.city}, ${createdOrder.shippingAddress.postalCode}<br>
                  <strong>${createdOrder.shippingAddress.country}</strong><br>
                  <span style="color: #2563eb;">${createdOrder.shippingAddress.email}</span>
                </p>
              </div>

              <!-- Re-using the Item List from earlier -->
              <h4 style="color: #374151; margin-bottom: 10px;">📦 Items to Pack:</h4>
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <thead>
                  <tr style="background-color: #f3f4f6;">
                    <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Item</th>
                    <th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  ${createdOrder.orderItems.map(item => `
                    <tr>
                      <td style="padding: 10px; border-bottom: 1px solid #eee; color: #333;">
                        <strong>${item.name}</strong>
                      </td>
                      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">
                        x${item.quantity}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>

              <!-- Action Button -->
              <div style="margin-top: 30px; text-align: center;">
                <a href="https://ironicgym.com/admin/orders" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">Manage Order in Dashboard</a>
              </div>
              
            </div>
            <div style="background-color: #f3f4f6; padding: 10px; text-align: center; font-size: 12px; color: #888;">
              System Notification • IRONIC Store
            </div>
          </div>
        `;
        await resend.emails.send({
          from: "IRONIC Admin <noreply@ironicgym.com>",
          to: adminEmails, 
          // Subject Example: "🔔 NEW ORDER: Harman spent $50.00"
          subject: `🔔 NEW ORDER: ${createdOrder.shippingAddress.name} spent $${(createdOrder.totalPrice / 100).toFixed(2)}`,
          html: adminEmailHtml, // We re-use the same receipt HTML so you see exactly what they bought
        });
        console.log("Admin notification sent to:", adminEmails);
      }
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
    const orders = await Order.find({}).populate("user", "name email phone countryCode").sort({ createdAt: -1 });
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

    if (!order) return res.status(404).json({ message: "Order not found" });

    // Update fields
    if (req.body.status) order.status = req.body.status;
    if (req.body.deliveredAt) order.deliveredAt = req.body.deliveredAt;

    const updatedOrder = await order.save();

    // EMAIL TRIGGER STATUSES
    const allowedStatuses = ["Accepted", "Dispatched", "Completed"];
    const status = req.body.status;

    if (allowedStatuses.includes(status)) {
      const emailText = {
        Accepted: "Your order has been accepted and will be prepared shortly.",
        Dispatched: "Great news! Your order has been dispatched.",
        Completed: "Your order has been successfully delivered!",
      };

     
      const statusUpdateEmailHtml = `
        <div style="background: #f5f7fa; padding: 40px 0; font-family: 'Segoe UI', sans-serif;">
          <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
            <div style="background: linear-gradient(135deg, #1f2937, #111827); padding: 25px; text-align: center;">
              <h2 style="color: #ffffff; margin: 0; font-size: 22px;">IRONIC Store — Order Update</h2>
            </div>

            <div style="padding: 25px; color: #333;">
              <p style="font-size: 16px;">Hi <strong>${order.shippingAddress.name}</strong>,</p>
              <p style="font-size: 15px;">We wanted to update you regarding your order.</p>

              <div style="background: #eef4ff; padding: 15px 20px; border-left: 4px solid #3b82f6; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 0; font-size: 17px;"><strong>Order Status:</strong> <span style="color: #1e40af;">${status}</span></p>
              </div>

              <p style="font-size: 15px; line-height: 1.6;">${emailText[status]}</p>

              <div style="margin-top: 25px;">
                <p style="margin: 6px 0;"><strong>Order ID:</strong> ${order._id}</p>
                <p style="margin: 6px 0;"><strong>Name:</strong> ${order.shippingAddress.name}</p>
              </div>

              <div style="margin-top: 30px; text-align: center;">
                <a href="https://ironicgym.com" style="background: #2563eb; padding: 12px 20px; color: white; text-decoration: none; border-radius: 8px;">View Order Details</a>
              </div>

              <p style="margin-top: 35px; font-size: 14px; color: #666; text-align: center;">If you have any questions, feel free to reply.</p>
            </div>

            <div style="background: #f3f4f6; padding: 15px; text-align: center;">
              <p style="margin: 0; font-size: 13px; color: #555;">© IRONIC Store • Automated Notification</p>
            </div>
          </div>
        </div>
      `;

      try {
        await resend.emails.send({
          from: "IRONIC Store <noreply@ironicgym.com>",
          to: order.shippingAddress.email,
          subject: `Your Order Status: ${status}`,
          html: statusUpdateEmailHtml,
        });

        console.log(`Status email sent (${status}) → ${order.shippingAddress.email}`);
      } catch (emailErr) {
        console.error("Status email error:", emailErr.message);
      }
    }

    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({ message: "Server error updating status" });
  }
});



module.exports = router;





