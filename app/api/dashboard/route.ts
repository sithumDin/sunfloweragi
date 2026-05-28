import connectDB from '@/lib/mongodb';
import Sale from '@/lib/models/Sale';
import Product from '@/lib/models/Product';
import Customer from '@/lib/models/Customer';
import Credit from '@/lib/models/Credit';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connectDB();

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    // Today's stats
    const todaySales = await Sale.find({ date: { $gte: todayStart } });
    const todayRevenue = todaySales.reduce((sum: number, s: { total: number }) => sum + s.total, 0);
    const todayProfit = todaySales.reduce((sum: number, s: { profit: number }) => sum + s.profit, 0);
    const todayCount = todaySales.length;

    // Daily sales by cashier
    const cashierBreakdown: Record<string, { revenue: number; count: number }> = {};
    for (const sale of todaySales) {
      const name = sale.cashierName || 'Admin';
      if (!cashierBreakdown[name]) cashierBreakdown[name] = { revenue: 0, count: 0 };
      cashierBreakdown[name].revenue += sale.total;
      cashierBreakdown[name].count += 1;
    }

    // Week stats
    const weekSales = await Sale.find({ date: { $gte: weekStart } });
    const weekRevenue = weekSales.reduce((sum: number, s: { total: number }) => sum + s.total, 0);
    const weekProfit = weekSales.reduce((sum: number, s: { profit: number }) => sum + s.profit, 0);

    // Month stats
    const monthSales = await Sale.find({ date: { $gte: monthStart } });
    const monthRevenue = monthSales.reduce((sum: number, s: { total: number }) => sum + s.total, 0);
    const monthProfit = monthSales.reduce((sum: number, s: { profit: number }) => sum + s.profit, 0);

    // Year stats
    const yearSales = await Sale.find({ date: { $gte: yearStart } });
    const yearRevenue = yearSales.reduce((sum: number, s: { total: number }) => sum + s.total, 0);
    const yearProfit = yearSales.reduce((sum: number, s: { profit: number }) => sum + s.profit, 0);

    // Total counts
    const totalCustomers = await Customer.countDocuments();
    const totalProducts = await Product.countDocuments();
    const lowStockProducts = await Product.find({
      $expr: { $lte: ['$stock', '$lowStockThreshold'] },
    });

    // Outstanding credit
    const pendingCredits = await Credit.find({ status: { $ne: 'paid' } });
    const totalOutstanding = pendingCredits.reduce(
      (sum: number, c: { remainingAmount: number }) => sum + c.remainingAmount,
      0
    );

    // Recent sales
    const recentSales = await Sale.find({}).sort({ date: -1 }).limit(10);

    // Daily profit for last 7 days
    const dailyProfits = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(todayStart);
      dayStart.setDate(dayStart.getDate() - i);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const daySales = await Sale.find({ date: { $gte: dayStart, $lt: dayEnd } });
      const profit = daySales.reduce((sum: number, s: { profit: number }) => sum + s.profit, 0);
      const revenue = daySales.reduce((sum: number, s: { total: number }) => sum + s.total, 0);
      dailyProfits.push({
        date: dayStart.toISOString().split('T')[0],
        profit,
        revenue,
      });
    }

    // Sales by category
    const allSales = await Sale.find({ date: { $gte: monthStart } });
    const categoryMap: Record<string, number> = {};
    for (const sale of allSales) {
      for (const item of sale.items) {
        const product = await Product.findById(item.product);
        const cat = product?.category || 'Other';
        categoryMap[cat] = (categoryMap[cat] || 0) + item.total;
      }
    }

    return Response.json({
      today: { revenue: todayRevenue, profit: todayProfit, count: todayCount },
      week: { revenue: weekRevenue, profit: weekProfit },
      month: { revenue: monthRevenue, profit: monthProfit },
      year: { revenue: yearRevenue, profit: yearProfit },
      totalCustomers,
      totalProducts,
      lowStockProducts: lowStockProducts.length,
      lowStockList: lowStockProducts,
      totalOutstanding,
      recentSales,
      dailyProfits,
      categoryBreakdown: categoryMap,
      cashierBreakdown,
    });
  } catch (error) {
    console.error('Server Error:', error);

    // Return a safe fallback payload so the dashboard can still render
    // even when the database is temporarily unavailable.
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dailyProfits = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(todayStart);
      day.setDate(day.getDate() - i);
      dailyProfits.push({
        date: day.toISOString().split('T')[0],
        profit: 0,
        revenue: 0,
      });
    }

    return Response.json({
      today: { revenue: 0, profit: 0, count: 0 },
      week: { revenue: 0, profit: 0 },
      month: { revenue: 0, profit: 0 },
      year: { revenue: 0, profit: 0 },
      totalCustomers: 0,
      totalProducts: 0,
      lowStockProducts: 0,
      lowStockList: [],
      totalOutstanding: 0,
      recentSales: [],
      dailyProfits,
      categoryBreakdown: {},
      cashierBreakdown: {},
      warning: 'Database temporarily unavailable',
    });
  }
}
