async function fetchPriceHistory() {
  const res = await fetch('/api/sglcn-xau/history');
  const data = await res.json();

  return data.map(entry => ({
    x: new Date(entry.timestamp),
    y: entry.price
  }));
}

async function renderChart() {
  const priceData = await fetchPriceHistory();

  const ctx = document.getElementById('priceChart').getContext('2d');
  new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [{
        label: 'SGLCN-XAU Price',
        data: priceData,
        borderColor: '#4ade80',
        backgroundColor: 'rgba(74, 222, 128, 0.2)',
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      scales: {
        x: {
          type: 'time',
          time: {
            tooltipFormat: 'MMM d, yyyy HH:mm',
            unit: 'day'
          },
          title: {
            display: true,
            text: 'Timestamp'
          }
        },
        y: {
          title: {
            display: true,
            text: 'Price'
          }
        }
      },
      responsive: true,
      plugins: {
        legend: { display: true }
      }
    }
  });
}

renderChart();
