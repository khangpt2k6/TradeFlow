import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api";

const PaymentProcessor = () => {
  const [paymentCount, setPaymentCount] = useState(100);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [customPayments, setCustomPayments] = useState([
    { fromAccountId: "", toAccountId: "", amount: "" }
  ]);

  useEffect(() => {
    loadMetrics();
    const interval = setInterval(loadMetrics, 5000); // Refresh metrics every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const loadMetrics = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await axios.get(`${API_BASE_URL}/payments/metrics`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setMetrics(response.data.metrics);
      }
    } catch (error) {
      console.error("Error loading metrics:", error);
    }
  };

  const processPayments = async () => {
    setIsProcessing(true);
    setResults(null);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Please login first");
        return;
      }

      const requestBody = {
        count: paymentCount,
        payments: customPayments.filter(p => 
          p.fromAccountId && p.toAccountId && p.amount
        ).map(p => ({
          fromAccountId: parseInt(p.fromAccountId),
          toAccountId: parseInt(p.toAccountId),
          amount: parseFloat(p.amount)
        }))
      };

      const startTime = Date.now();
      const response = await axios.post(
        `${API_BASE_URL}/payments/process-batch`,
        requestBody,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      if (response.data.success) {
        setResults({
          ...response.data.results,
          actualDuration: duration
        });
        toast.success(`Processed ${response.data.results.processed} payments successfully!`);
        loadMetrics();
      }
    } catch (error) {
      console.error("Error processing payments:", error);
      toast.error(error.response?.data?.message || "Failed to process payments");
    } finally {
      setIsProcessing(false);
    }
  };

  const resetMetrics = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      await axios.post(
        `${API_BASE_URL}/payments/reset-metrics`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      toast.success("Metrics reset successfully");
      loadMetrics();
      setResults(null);
    } catch (error) {
      console.error("Error resetting metrics:", error);
      toast.error("Failed to reset metrics");
    }
  };

  const addCustomPayment = () => {
    setCustomPayments([...customPayments, { fromAccountId: "", toAccountId: "", amount: "" }]);
  };

  const removeCustomPayment = (index) => {
    setCustomPayments(customPayments.filter((_, i) => i !== index));
  };

  const updateCustomPayment = (index, field, value) => {
    const updated = [...customPayments];
    updated[index][field] = value;
    setCustomPayments(updated);
  };

  return (
    <div className="dashboard-page">
      <div className="container-fluid">
        <div className="row">
          <div className="col-12">
            <h1 className="mb-4">Multi-Threaded Payment Processor</h1>
            <p className="text-secondary mb-4">
              Simulate concurrent payment processing with thread-safe account management
            </p>
          </div>
        </div>

        {/* Metrics Card */}
        {metrics && (
          <div className="row mb-4">
            <div className="col-12">
              <div className="card-glass p-4">
                <h3 className="mb-3">Processing Metrics</h3>
                <div className="row">
                  <div className="col-md-3">
                    <div className="stat-card-professional">
                      <div className="stat-label">Processed</div>
                      <div className="stat-value">{metrics.processed || 0}</div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="stat-card-professional">
                      <div className="stat-label">Successful</div>
                      <div className="stat-value text-success">{metrics.successful || 0}</div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="stat-card-professional">
                      <div className="stat-label">Failed</div>
                      <div className="stat-value text-danger">{metrics.failed || 0}</div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="stat-card-professional">
                      <div className="stat-label">Success Rate</div>
                      <div className="stat-value">
                        {metrics.successRate ? `${metrics.successRate.toFixed(2)}%` : "0%"}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="row mt-3">
                  <div className="col-md-6">
                    <div className="stat-card-professional">
                      <div className="stat-label">Retries</div>
                      <div className="stat-value">{metrics.retries || 0}</div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="stat-card-professional">
                      <div className="stat-label">Thread Pool Size</div>
                      <div className="stat-value">{metrics.threadPoolSize || 8}</div>
                    </div>
                  </div>
                </div>
                <button
                  className="btn btn-outline-danger mt-3"
                  onClick={resetMetrics}
                >
                  Reset Metrics
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Payment Processing Card */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card-glass p-4">
              <h3 className="mb-3">Process Payments</h3>
              
              <div className="mb-4">
                <label className="form-label">Number of Payments to Generate</label>
                <input
                  type="number"
                  className="form-control"
                  value={paymentCount}
                  onChange={(e) => setPaymentCount(parseInt(e.target.value) || 100)}
                  min="1"
                  max="1000"
                  disabled={isProcessing}
                />
                <small className="text-muted">
                  Random payments will be generated between accounts 1-5
                </small>
              </div>

              <div className="mb-4">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <label className="form-label mb-0">Custom Payments (Optional)</label>
                  <button
                    className="btn btn-sm btn-outline-primary"
                    onClick={addCustomPayment}
                    disabled={isProcessing}
                  >
                    + Add Payment
                  </button>
                </div>
                {customPayments.map((payment, index) => (
                  <div key={index} className="row mb-2">
                    <div className="col-md-4">
                      <input
                        type="number"
                        className="form-control"
                        placeholder="From Account ID"
                        value={payment.fromAccountId}
                        onChange={(e) => updateCustomPayment(index, "fromAccountId", e.target.value)}
                        disabled={isProcessing}
                      />
                    </div>
                    <div className="col-md-4">
                      <input
                        type="number"
                        className="form-control"
                        placeholder="To Account ID"
                        value={payment.toAccountId}
                        onChange={(e) => updateCustomPayment(index, "toAccountId", e.target.value)}
                        disabled={isProcessing}
                      />
                    </div>
                    <div className="col-md-3">
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        placeholder="Amount"
                        value={payment.amount}
                        onChange={(e) => updateCustomPayment(index, "amount", e.target.value)}
                        disabled={isProcessing}
                      />
                    </div>
                    <div className="col-md-1">
                      {customPayments.length > 1 && (
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => removeCustomPayment(index)}
                          disabled={isProcessing}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <button
                className="btn btn-primary btn-lg w-100"
                onClick={processPayments}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Processing Payments...
                  </>
                ) : (
                  "Process Payments Concurrently"
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Results Card */}
        {results && (
          <div className="row">
            <div className="col-12">
              <div className="card-glass p-4">
                <h3 className="mb-3">Processing Results</h3>
                <div className="row">
                  <div className="col-md-4">
                    <div className="stat-card-professional">
                      <div className="stat-label">Total Requests</div>
                      <div className="stat-value">{results.totalRequests || 0}</div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="stat-card-professional">
                      <div className="stat-label">Processed</div>
                      <div className="stat-value">{results.processed || 0}</div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="stat-card-professional">
                      <div className="stat-label">Successful</div>
                      <div className="stat-value text-success">{results.successful || 0}</div>
                    </div>
                  </div>
                </div>
                <div className="row mt-3">
                  <div className="col-md-4">
                    <div className="stat-card-professional">
                      <div className="stat-label">Failed</div>
                      <div className="stat-value text-danger">{results.failed || 0}</div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="stat-card-professional">
                      <div className="stat-label">Retries</div>
                      <div className="stat-value">{results.retries || 0}</div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="stat-card-professional">
                      <div className="stat-label">Duration</div>
                      <div className="stat-value">
                        {results.actualDuration || results.durationMs || 0}ms
                      </div>
                    </div>
                  </div>
                </div>
                {results.throughput && (
                  <div className="mt-3">
                    <div className="stat-card-professional">
                      <div className="stat-label">Throughput</div>
                      <div className="stat-value">
                        {results.throughput.toFixed(2)} payments/sec
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Info Card */}
        <div className="row mt-4">
          <div className="col-12">
            <div className="card-glass p-4">
              <h4>Features Demonstrated</h4>
              <ul>
                <li><strong>Concurrent Processing:</strong> Uses ExecutorService with 8 threads</li>
                <li><strong>Thread-Safe Operations:</strong> ReentrantLock per account prevents race conditions</li>
                <li><strong>Transaction Validation:</strong> Amount limits and account validation</li>
                <li><strong>Asynchronous Logging:</strong> Producer-Consumer pattern with BlockingQueue</li>
                <li><strong>Network Delay Simulation:</strong> 50-200ms delays per transaction</li>
                <li><strong>Retry Mechanism:</strong> Up to 3 retry attempts with CompletableFuture</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentProcessor;

