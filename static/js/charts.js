// Chart functionality for interactive charts
document.addEventListener('DOMContentLoaded', function() {
    // Initialize charts if chart data exists
    const chartDataElement = document.getElementById('chart-data');
    if (!chartDataElement) {
        console.log("No chart data element found");
        return;
    }

    try {
        const chartData = JSON.parse(chartDataElement.textContent);
        if (!chartData) {
            console.log("Chart data element exists but no data found");
            return;
        }

        console.log("Chart data loaded successfully");

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

        // Handler for chart clicks based on chart type
        function handleChartClick(event, chartType, activeElements, chart) {
            if (activeElements.length === 0) return;

            const index = activeElements[0].index;
            const project = chart.data.labels[index];
            console.log(`Chart click: ${chartType}, Project: ${project}`);

            // Формирование специфичного JQL запроса в зависимости от типа графика
            if (chartType === 'no_transitions') {
                // Для графика "Открытые задачи со списаниями"
                createSpecialJQL(project, 'open_tasks');
            } else {
                // Для стандартных графиков используем обычную ссылку
                if (typeof createJiraLink === 'function') {
                    createJiraLink(project);
                } else {
                    console.error("createJiraLink function not found");
                }
            }
        }

        // Функция для создания специального JQL запроса
        function createSpecialJQL(project, chartType) {
            // Базовые параметры
            const params = new URLSearchParams();
            const dateFrom = document.querySelector('[data-date-from]')?.getAttribute('data-date-from');
            const dateTo = document.querySelector('[data-date-to]')?.getAttribute('data-date-to');
            const baseJql = document.querySelector('[data-base-jql]')?.getAttribute('data-base-jql');

            params.append('project', project);
            params.append('chart_type', chartType);
            if (dateFrom) params.append('date_from', dateFrom);
            if (dateTo) params.append('date_to', dateTo);
            if (baseJql) params.append('base_jql', baseJql);

            // Запрос на сервер для формирования специального JQL
            fetch(`/jql/special?${params.toString()}`)
                .then(response => response.json())
                .then(data => {
                    // Заполняем модальное окно
                    document.getElementById('jqlQuery').value = data.jql;
                    document.getElementById('openJiraBtn').href = data.url;

                    // Показываем модальное окно
                    const bsJqlModal = new bootstrap.Modal(document.getElementById('jqlModal'));
                    bsJqlModal.show();
                })
                .catch(error => {
                    console.error('Error generating special JQL:', error);
                    alert('Ошибка при формировании JQL запроса');

                    // Если произошла ошибка, используем обычную ссылку
                    if (typeof createJiraLink === 'function') {
                        createJiraLink(project);
                    }
                });
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

        // Comparison chart (estimate vs. time spent)
        const ctxComparison = document.getElementById('comparisonChart');
        if (ctxComparison && chartData.project_estimates && chartData.project_time_spent) {
            console.log("Initializing comparison chart");
            // Collect all unique projects
            const allProjects = [...new Set([
                ...Object.keys(chartData.project_estimates),
                ...Object.keys(chartData.project_time_spent)
            ])];

            if (allProjects.length > 0) {
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

                try {
                    const comparisonChart = new Chart(ctxComparison.getContext('2d'), {
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
                } catch (err) {
                    console.error("Error creating comparison chart:", err);
                }
            } else {
                console.log("No projects with estimates or time spent");
            }
        } else {
            console.log("Comparison chart not initialized - missing element or data");
        }

        // No transitions tasks chart (переименованные в "Открытые задачи со списаниями")
        const ctxNoTrans = document.getElementById('noTransitionsChart');
        if (ctxNoTrans && chartData.special_charts && chartData.special_charts.no_transitions) {
            console.log("Initializing No Transitions Chart (renamed to Open Tasks with Worklogs)");

            const noTransData = chartData.special_charts.no_transitions;
            const noTransLabels = Object.keys(noTransData.by_project || {});

            // Only create the chart if we have data
            if (noTransLabels.length > 0) {
                const noTransValues = noTransLabels.map(project => noTransData.by_project[project] || 0);
                const noTransColors = getChartColors(noTransLabels.length);

                try {
                    const noTransChart = new Chart(ctxNoTrans.getContext('2d'), {
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
                } catch (err) {
                    console.error("Error creating no transitions chart:", err);
                }
            } else {
                console.log("No transitions chart has no data");
            }
        } else {
            console.log("No transitions chart not initialized - missing element or data");
        }

        // Projects Pie Chart (переименованный в "Распределение задач по проектам")
        const ctxProjectsPie = document.getElementById('projectsPieChart');
        if (ctxProjectsPie && chartData.project_counts && Object.keys(chartData.project_counts).length > 0) {
            console.log("Initializing projects pie chart");

            // Сортируем проекты по количеству задач (от большего к меньшему)
            const sortedProjects = Object.entries(chartData.project_counts)
                .sort((a, b) => b[1] - a[1]);

            // Возьмем топ-10 проектов, остальные объединим в "Другие"
            const TOP_PROJECTS = 10;
            const topProjects = sortedProjects.slice(0, TOP_PROJECTS);
            const otherProjects = sortedProjects.slice(TOP_PROJECTS);

            let labels = topProjects.map(item => item[0]);
            let values = topProjects.map(item => item[1]);

            // Если есть другие проекты, добавляем их как одну категорию
            if (otherProjects.length > 0) {
                const otherValue = otherProjects.reduce((sum, item) => sum + item[1], 0);
                labels.push('Другие');
                values.push(otherValue);
            }

            const pieColors = getChartColors(labels.length);

            try {
                const pieChart = new Chart(ctxProjectsPie.getContext('2d'), {
                    type: 'pie',
                    data: {
                        labels: labels,
                        datasets: [{
                            data: values,
                            backgroundColor: pieColors,
                            borderColor: pieColors.map(color => color.replace('0.7', '1')),
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'right',
                                labels: {
                                    boxWidth: 15,
                                    padding: 10
                                }
                            },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        const label = context.label || '';
                                        const value = context.parsed || 0;
                                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                        const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                        return `${label}: ${value} задач (${percentage}%)`;
                                    }
                                }
                            }
                        },
                        onClick: (event, activeElements) => {
                            if (activeElements.length > 0) {
                                const index = activeElements[0].index;
                                const project = labels[index];

                                // Не открываем Jira для категории "Другие"
                                if (project !== 'Другие') {
                                    handleChartClick(event, 'pie', activeElements, pieChart);
                                } else {
                                    console.log("Clicked on 'Others' category - no action");
                                }
                            }
                        }
                    }
                });
            } catch (err) {
                console.error("Error creating projects pie chart:", err);
            }
        } else {
            console.log("Projects pie chart not initialized - missing element or data");
        }
    } catch (error) {
        console.error('Error initializing charts:', error);
    }
});