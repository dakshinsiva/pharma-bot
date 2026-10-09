const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');

/**
 * Customer Management Routes
 */

/**
 * POST /api/customers
 * Create a new customer
 */
router.post('/', async (req, res) => {
  try {
    const { name, phone } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        error: 'name and phone are required',
      });
    }

    const customer = await prisma.customer.create({
      data: {
        name,
        phone,
        status: 'pending',
      },
    });

    res.json({
      success: true,
      customer: customer,
    });
  } catch (error) {
    console.error('[CustomerRoutes] Error creating customer:', error);
    
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: 'Customer with this phone number already exists',
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/customers/batch
 * Create multiple customers
 */
router.post('/batch', async (req, res) => {
  try {
    const { customers } = req.body;

    if (!customers || !Array.isArray(customers)) {
      return res.status(400).json({
        success: false,
        error: 'customers array is required',
      });
    }

    const created = [];
    const errors = [];

    for (const customer of customers) {
      try {
        const newCustomer = await prisma.customer.create({
          data: {
            name: customer.name,
            phone: customer.phone,
            status: 'pending',
          },
        });
        created.push(newCustomer);
      } catch (error) {
        errors.push({
          customer: customer,
          error: error.message,
        });
      }
    }

    res.json({
      success: true,
      created: created.length,
      errors: errors.length,
      customers: created,
      errorDetails: errors,
    });
  } catch (error) {
    console.error('[CustomerRoutes] Error creating customers:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/customers
 * Get all customers with optional filters
 */
router.get('/', async (req, res) => {
  try {
    const { status, limit = 100, offset = 0 } = req.query;

    const where = status ? { status } : {};

    const customers = await prisma.customer.findMany({
      where: where,
      take: parseInt(limit),
      skip: parseInt(offset),
      orderBy: { createdAt: 'desc' },
    });

    const total = await prisma.customer.count({ where });

    res.json({
      success: true,
      count: customers.length,
      total: total,
      customers: customers,
    });
  } catch (error) {
    console.error('[CustomerRoutes] Error fetching customers:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/customers/:id
 * Get a single customer by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        orders: true,
        callbacks: true,
        callLogs: {
          orderBy: { startTime: 'desc' },
          take: 10,
        },
      },
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
      });
    }

    res.json({
      success: true,
      customer: customer,
    });
  } catch (error) {
    console.error('[CustomerRoutes] Error fetching customer:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PUT /api/customers/:id
 * Update a customer
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, status } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (status) updateData.status = status;

    const customer = await prisma.customer.update({
      where: { id },
      data: updateData,
    });

    res.json({
      success: true,
      customer: customer,
    });
  } catch (error) {
    console.error('[CustomerRoutes] Error updating customer:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/customers/:id
 * Delete a customer
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.customer.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Customer deleted',
    });
  } catch (error) {
    console.error('[CustomerRoutes] Error deleting customer:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/customers/:id/orders
 * Get all orders for a customer
 */
router.get('/:id/orders', async (req, res) => {
  try {
    const { id } = req.params;

    const orders = await prisma.order.findMany({
      where: { customerId: id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      count: orders.length,
      orders: orders,
    });
  } catch (error) {
    console.error('[CustomerRoutes] Error fetching orders:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/customers/:id/callbacks
 * Get all callbacks for a customer
 */
router.get('/:id/callbacks', async (req, res) => {
  try {
    const { id } = req.params;

    const callbacks = await prisma.callback.findMany({
      where: { customerId: id },
      orderBy: { callbackTime: 'asc' },
    });

    res.json({
      success: true,
      count: callbacks.length,
      callbacks: callbacks,
    });
  } catch (error) {
    console.error('[CustomerRoutes] Error fetching callbacks:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/customers/:id/call-logs
 * Get all call logs for a customer
 */
router.get('/:id/call-logs', async (req, res) => {
  try {
    const { id } = req.params;

    const callLogs = await prisma.callLog.findMany({
      where: { customerId: id },
      orderBy: { startTime: 'desc' },
    });

    res.json({
      success: true,
      count: callLogs.length,
      callLogs: callLogs,
    });
  } catch (error) {
    console.error('[CustomerRoutes] Error fetching call logs:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;






