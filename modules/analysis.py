import os
import json
import logging
from datetime import datetime
from routes.main_routes import analysis_state
from modules.jira_analyzer import JiraAnalyzer

# Get logger
logger = logging.getLogger(__name__)

# Directory for saving charts
CHARTS_DIR = 'jira_charts'


def run_analysis(use_filter=True, filter_id=114476, jql_query=None, date_from=None, date_to=None):
    """
    Run Jira data analysis in a separate thread

    Args:
        use_filter (bool): Whether to use filter ID or JQL query
        filter_id (str/int): ID of Jira filter to use
        jql_query (str): JQL query to use instead of filter ID
        date_from (str): Start date for worklog filtering (YYYY-MM-DD)
        date_to (str): End date for worklog filtering (YYYY-MM-DD)
    """
    global analysis_state

    try:
        analysis_state['is_running'] = True
        analysis_state['progress'] = 0
        analysis_state['status_message'] = 'Initializing analysis...'

        # Create timestamp folder
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_dir = os.path.join(CHARTS_DIR, timestamp)
        analysis_state['current_folder'] = timestamp

        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

        # Create directory for JSON data
        data_dir = os.path.join(output_dir, 'data')
        if not os.path.exists(data_dir):
            os.makedirs(data_dir)

        # Create directory for metrics
        metrics_dir = os.path.join(output_dir, 'metrics')
        if not os.path.exists(metrics_dir):
            os.makedirs(metrics_dir)

        # Initialize Jira analyzer
        analyzer = JiraAnalyzer()

        # Create JQL query with time period
        final_jql = ""
        if use_filter:
            final_jql = f'filter={filter_id}'
        else:
            final_jql = jql_query or ""

        # Add date filtering if specified
        date_conditions = []
        if date_from:
            date_conditions.append(f'worklogDate >= "{date_from}"')
        if date_to:
            date_conditions.append(f'worklogDate <= "{date_to}"')

        if date_conditions:
            if final_jql:
                final_jql = f"({final_jql}) AND ({' AND '.join(date_conditions)})"
            else:
                final_jql = ' AND '.join(date_conditions)

        analysis_state['status_message'] = f'Using query: {final_jql}'
        analysis_state['progress'] = 10

        # Fetch issues
        analysis_state['status_message'] = 'Fetching issues from Jira...'
        issues = analyzer.get_issues_by_filter(jql_query=final_jql)

        analysis_state['total_issues'] = len(issues)
        analysis_state['status_message'] = f'Found {len(issues)} issues.'
        analysis_state['progress'] = 30

        if not issues:
            analysis_state['status_message'] = "No issues found. Check query or credentials."
            analysis_state['is_running'] = False
            return

        # Process data
        analysis_state['status_message'] = 'Processing issue data...'
        analysis_state['progress'] = 50
        df = analyzer.process_issues_data(issues)

        # Save raw data for interactive charts
        raw_data_path = os.path.join(data_dir, 'raw_data.json')
        df.to_json(raw_data_path, orient='records')

        # Create visualizations
        analysis_state['status_message'] = 'Creating visualizations...'
        analysis_state['progress'] = 70
        chart_paths = analyzer.create_visualizations(df, output_dir)

        # Generate data for interactive charts
        analysis_state['status_message'] = 'Creating interactive charts...'
        analysis_state['progress'] = 80

        # Project data
        project_counts = df['project'].value_counts().to_dict()
        project_estimates = df.groupby('project')['original_estimate_hours'].sum().to_dict()
        project_time_spent = df.groupby('project')['time_spent_hours'].sum().to_dict()

        # Save data for interactive charts
        chart_data = {
            'project_counts': project_counts,
            'project_estimates': project_estimates,
            'project_time_spent': project_time_spent,
            'projects': list(
                set(list(project_counts.keys()) + list(project_estimates.keys()) + list(project_time_spent.keys()))),
            'filter_params': {
                'filter_id': filter_id if use_filter else None,
                'jql': jql_query if not use_filter else None,
                'date_from': date_from,
                'date_to': date_to
            }
        }

        chart_data_path = os.path.join(data_dir, 'chart_data.json')
        with open(chart_data_path, 'w', encoding='utf-8') as f:
            json.dump(chart_data, f, indent=4, ensure_ascii=False)

        # Create index file with chart information
        index_data = {
            'timestamp': timestamp,
            'total_issues': len(issues),
            'charts': chart_paths,
            'summary': {},
            'date_from': date_from,
            'date_to': date_to,
            'filter_id': filter_id if use_filter else None,
            'jql_query': jql_query if not use_filter else None
        }

        # Load summary data if available
        summary_path = chart_paths.get('summary')
        if summary_path and os.path.exists(summary_path):
            try:
                with open(summary_path, 'r', encoding='utf-8') as f:
                    summary_data = json.load(f)
                    index_data['summary'] = summary_data
            except Exception as e:
                logger.error(f"Error reading summary: {e}")

        # Save index file
        index_path = os.path.join(output_dir, 'index.json')
        with open(index_path, 'w', encoding='utf-8') as f:
            json.dump(index_data, f, indent=4, ensure_ascii=False)

        analysis_state['status_message'] = f'Analysis complete. Charts saved to {output_dir}.'
        analysis_state['progress'] = 100
        analysis_state['last_run'] = timestamp

        # Save raw issues for diagnostics
        raw_issues_path = os.path.join(output_dir, 'raw_issues.json')
        with open(raw_issues_path, 'w', encoding='utf-8') as f:
            json.dump(issues, f, indent=2, ensure_ascii=False)
        logger.info(f"Raw issue data saved to {raw_issues_path}")

    except Exception as e:
        logger.error(f"Error during analysis: {e}", exc_info=True)
        analysis_state['status_message'] = f"An error occurred: {str(e)}"
    finally:
        analysis_state['is_running'] = False