// Chart functionality for interactive charts
document.addEventListener('DOMContentLoaded', function() {
    // Initialize charts if chart data exists
    const chartDataElement = document.getElementById('chart-data');
    if (!chartDataElement) return;

    try {
        const chartData = JSON.parse(chartDataElement.textContent);
        if (!chartData) return;

        // Function to get colors for charts
        function getChartColors(count) {
            const colors = [];
            for (let i = 0; i < count; i++) {
                // Cycle through colors using golden angle for even distribution
                const hue = (i * 137) % 360;
                colors.push(`hsla(${hue}, 70%, 60%, 0.7)`);
            }
            return colors;
        }

        // Handler for chart clicks to open Jira
        function handleChartClick(event, chartType, activeElements, chart) {
            if (activeElements.length > 0) {
                const index = activeElements[0].index;
                const project = chart.data.labels[index];
                createJiraLink(project);
            }
        }

        // Common chart options
        const commonOptions = {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            },
            layout: {
                padding: {
                    left: 10,
                    right: 10,
                    top: 0,
                    bottom: 20
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        boxWidth: 15,
                        padding: 10
                    }
                }
            }
        };

        // Project distribution chart
        if (chartData.project_counts && Object.keys(chartData.project_counts).length > 0) {
            const projectLabels = Object.keys(chartData.project_counts);
            const projectValues = projectLabels.map(project => chartData.project_counts[project] || 0);
            const projectColors = getChartColors(projectLabels.length);

            const ctxProjects = document.getElementById('projectDistributionChart')?.getContext('2d');
            if (ctxProjects) {
                const projectChart = new Chart(ctxProjects, {
                    type: 'bar',
                    data: {
                        labels: projectLabels,
                        datasets: [{
                            label: 'Количество задач',
                            data: projectValues,
                            backgroundColor: projectColors,
                            borderColor: projectColors.map(color => color.replace('0.7', '1')),
                            borderWidth: 1
                        }]
                    },
                    options: {
                        ...commonOptions,
                        onClick: (event, activeElements) => {
                            handleChartClick(event, 'projects', activeElements, projectChart);
                        }
                    }
                });
            }
        }

        // Comparison chart (estimate vs. time spent)
        if ((chartData.project_estimates && Object.keys(chartData.project_estimates).length > 0) &&
            (chartData.project_time_spent && Object.keys(chartData.project_time_spent).length > 0)) {

            // Collect all unique projects
            const allProjects = [...new Set([
                ...Object.keys(chartData.project_estimates),
                ...Object.keys(chartData.project_time_spent)
            ])];

            // Sort projects by sum of estimate and time spent (descending)
            allProjects.sort((a, b) => {
                const aTotal = (chartData.project_estimates[a] || 0) + (chartData.project_time_spent[a] || 0);
                const bTotal = (chartData.project_estimates[b] || 0) + (chartData.project_time_spent[b] || 0);
                return bTotal - aTotal;
            });

            // Limit number of projects for readability
            const topProjects = allProjects.slice(0, 10);

            const estimateData = topProjects.map(project => chartData.project_estimates[project] || 0);
            const timeSpentData = topProjects.map(project => chartData.project_time_spent[project] || 0);

            const ctxComparison = document.getElementById('comparisonChart')?.getContext('2d');
            if (ctxComparison) {
                const comparisonChart = new Chart(ctxComparison, {
                    type: 'bar',
                    data: {
                        labels: topProjects,
                        datasets: [
                            {
                                label: 'Исходная оценка (часы)',
                                data: estimateData,
                                backgroundColor: 'rgba(54, 162, 235, 0.7)',
                                borderColor: 'rgba(54, 162, 235, 1)',
                                borderWidth: 1
                            },
                            {
                                label: 'Затраченное время (часы)',
                                data: timeSpentData,
                                backgroundColor: 'rgba(255, 99, 132, 0.7)',
                                borderColor: 'rgba(255, 99, 132, 1)',
                                borderWidth: 1
                            }
                        ]
                    },
                    options: {
                        ...commonOptions,
                        onClick: (event, activeElements) => {
                            handleChartClick(event, 'comparison', activeElements, comparisonChart);
                        }
                    }
                });
            }
        }

        // SPECIAL CHARTS - Made interactive

        // 1. No transitions tasks chart (likely new tasks)
        if (chartData.special_charts && chartData.special_charts.no_transitions &&
            Object.keys(chartData.special_charts.no_transitions.by_project).length > 0) {

            const noTransLabels = Object.keys(chartData.special_charts.no_transitions.by_project);
            const noTransValues = noTransLabels.map(project =>
                chartData.special_charts.no_transitions.by_project[project] || 0);
            const noTransColors = getChartColors(noTransLabels.length);

            const ctxNoTrans = document.getElementById('noTransitionsChart')?.getContext('2d');
            if (ctxNoTrans) {
                const noTransChart = new Chart(ctxNoTrans, {
                    type: 'bar',
                    data: {
                        labels: noTransLabels,
                        datasets: [{
                            label: 'Количество задач',
                            data: noTransValues,
                            backgroundColor: noTransColors,
                            borderColor: noTransColors.map(color => color.replace('0.7', '1')),
                            borderWidth: 1
                        }]
                    },
                    options: {
                        ...commonOptions,
                        onClick: (event, activeElements) => {
                            handleChartClick(event, 'no_transitions', activeElements, noTransChart);
                        }
                    }
                });
            }
        }

        // 2. Open tasks with time logging chart
        if (chartData.special_charts && chartData.special_charts.open_tasks &&
            Object.keys(chartData.special_charts.open_tasks.by_project).length > 0) {

            const openTasksLabels = Object.keys(chartData.special_charts.open_tasks.by_project);
            const openTasksValues = openTasksLabels.map(project =>
                chartData.special_charts.open_tasks.by_project[project] || 0);
            const openTasksColors = getChartColors(openTasksLabels.length);

            const ctxOpenTasks = document.getElementById('openTasksChart')?.getContext('2d');
            if (ctxOpenTasks) {
                const openTasksChart = new Chart(ctxOpenTasks, {
                    type: 'bar',
                    data: {
                        labels: openTasksLabels,
                        datasets: [{
                            label: 'Затраченное время (часы)',
                            data: openTasksValues,
                            backgroundColor: openTasksColors,
                            borderColor: openTasksColors.map(color => color.replace('0.7', '1')),
                            borderWidth: 1
                        }]
                    },
                    options: {
                        ...commonOptions,
                        onClick: (event, activeElements) => {
                            handleChartClick(event, 'open_tasks', activeElements, openTasksChart);
                        }
                    }
                });
            }
        }

        // 3. Closed tasks without comments chart
        if (chartData.special_charts && chartData.special_charts.closed_no_comments &&
            Object.keys(chartData.special_charts.closed_no_comments.by_project).length > 0) {

            const closedTasksLabels = Object.keys(chartData.special_charts.closed_no_comments.by_project);
            const closedTasksValues = closedTasksLabels.map(project =>
                chartData.special_charts.closed_no_comments.by_project[project] || 0);
            const closedTasksColors = getChartColors(closedTasksLabels.length);

            const ctxClosedTasks = document.getElementById('closedTasksChart')?.getContext('2d');
            if (ctxClosedTasks) {
                const closedTasksChart = new Chart(ctxClosedTasks, {
                    type: 'bar',
                    data: {
                        labels: closedTasksLabels,
                        datasets: [{
                            label: 'Количество задач',
                            data: closedTasksValues,
                            backgroundColor: closedTasksColors,
                            borderColor: closedTasksColors.map(color => color.replace('0.7', '1')),
                            borderWidth: 1
                        }]
                    },
                    options: {
                        ...commonOptions,
                        onClick: (event, activeElements) => {
                            handleChartClick(event, 'closed_tasks', activeElements, closedTasksChart);
                        }
                    }
                });
            }
        }
    } catch (error) {
        console.error('Error initializing charts:', error);
    }
});