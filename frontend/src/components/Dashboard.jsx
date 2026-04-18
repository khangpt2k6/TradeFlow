import React, { useState, useEffect } from "react";
import {
  PeopleFill,
  Bank2,
  CashStack,
  GraphUp,
  ShieldCheck,
} from "react-bootstrap-icons";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { API_BASE_URL } from "../config/api";

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalCustomers: 0,
    activeCustomers: 0,
    totalAccounts: 0,
    activeAccounts: 0,
    totalTransactions: 0,
    totalBalance: 0,
    monthlyTransactions: 0,
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    // Check authentication status
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/trading");
      return;
    }
    setIsAuthenticated(true);
    fetchDashboardStats();
    generateChartData();
  }, [navigate]);

  const fetchDashboardStats = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE_URL}/dashboard/stats`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setStats(response.data);
      // Regenerate chart data with new stats
      generateChartData(response.data);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      if (error.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/trading");
        return;
      }
      // Set default values if API fails
      setStats({
        totalCustomers: 0,
        activeCustomers: 0,
        totalAccounts: 0,
        activeAccounts: 0,
        totalTransactions: 0,
        totalBalance: 0,
        monthlyTransactions: 0,
      });
      generateChartData();
    }
  };

  const generateChartData = (statsData = stats) => {
    // Generate sample data for the last 12 months
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const currentMonth = new Date().getMonth();
    
    const data = months.map((month, index) => {
      // Use actual transaction data if available, otherwise generate demo data
      const transactions = index === currentMonth 
        ? statsData.totalTransactions 
        : Math.floor(Math.random() * 150) + 20;
      
      const customers = index === currentMonth
        ? statsData.totalCustomers
        : Math.floor(Math.random() * 50) + 10;

      return {
        month,
        transactions,
        customers,
      };
    });

    setChartData(data);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat("en-US").format(num);
  };

  // Show loading or redirect if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="dashboard-page">
        <div className="text-center mt-5">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-container">
        {/* Header Section */}
        <div className="dashboard-header">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h1 className="dashboard-title">Welcome to TradeFlow</h1>
              <p className="dashboard-subtitle">
                Your secure financial management platform
              </p>
            </div>
            <div className="d-flex align-items-center gap-2">
              <ShieldCheck size={20} />
              <span className="system-status-badge">System Online</span>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="dashboard-stats-grid">
          <div className="stat-card-professional">
            <div className="stat-card-header">
              <div className="stat-icon-professional">
                <PeopleFill size={24} />
              </div>
              <span className="stat-badge-professional">
                {stats.activeCustomers} Active
              </span>
            </div>
            <div className="stat-value-professional">
              {formatNumber(stats.totalCustomers)}
            </div>
            <div className="stat-label-professional">Total Customers</div>
          </div>

          <div className="stat-card-professional">
            <div className="stat-card-header">
              <div className="stat-icon-professional">
                <Bank2 size={24} />
              </div>
              <span className="stat-badge-professional">
                {stats.activeAccounts} Active
              </span>
            </div>
            <div className="stat-value-professional">
              {formatNumber(stats.totalAccounts)}
            </div>
            <div className="stat-label-professional">Total Accounts</div>
          </div>

          <div className="stat-card-professional">
            <div className="stat-card-header">
              <div className="stat-icon-professional">
                <CashStack size={24} />
              </div>
              <span className="stat-badge-professional">Total Assets</span>
            </div>
            <div className="stat-value-professional">
              {formatCurrency(stats.totalBalance)}
            </div>
            <div className="stat-label-professional">Total Balance</div>
          </div>

          <div className="stat-card-professional">
            <div className="stat-card-header">
              <div className="stat-icon-professional">
                <GraphUp size={24} />
              </div>
              <span className="stat-badge-professional">This Month</span>
            </div>
            <div className="stat-value-professional">
              {formatNumber(stats.monthlyTransactions || stats.totalTransactions)}
            </div>
            <div className="stat-label-professional">Transactions</div>
          </div>
        </div>

        {/* Chart Section */}
        <div className="chart-section">
          <div className="chart-header">
            <div>
              <div className="chart-title">
                <div className="chart-title-icon">
                  <GraphUp size={20} />
                </div>
                Transaction Statistics
              </div>
              <p className="chart-subtitle">
                Overview of system performance over the last 12 months
              </p>
            </div>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTransactions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#254a8a" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#254a8a" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorCustomers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5d8ce0" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#5d8ce0" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e8f5" />
                <XAxis 
                  dataKey="month" 
                  stroke="#5d6c8c"
                  fontSize={12}
                  fontWeight={600}
                />
                <YAxis 
                  stroke="#5d6c8c"
                  fontSize={12}
                  fontWeight={600}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #c2d0ec",
                    borderRadius: "12px",
                    boxShadow: "0 8px 24px rgba(16, 42, 67, 0.1)",
                  }}
                  labelStyle={{ color: "#254a8a", fontWeight: 700, fontSize: 14 }}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: "20px" }}
                  iconType="circle"
                />
                <Area
                  type="monotone"
                  dataKey="transactions"
                  stroke="#254a8a"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorTransactions)"
                  name="Transactions"
                />
                <Area
                  type="monotone"
                  dataKey="customers"
                  stroke="#5d8ce0"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorCustomers)"
                  name="Customers"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
