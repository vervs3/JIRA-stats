import logging
from flask import request, jsonify
from modules.log_buffer import get_logs

# Get logger
logger = logging.getLogger(__name__)


def register_api_routes(app):
    """Register API routes"""

    # Add decorator to disable basic request logging for /logs to prevent log flooding
    @app.before_request
    def log_request_skip_logs():
        if request.path == '/logs':
            return None

    @app.route('/logs')
    def get_logs_route():
        """Return log entries from the buffer"""
        limit = request.args.get('limit', default=50, type=int)
        return jsonify(get_logs(limit))

    @app.route('/jql/project/<project>')
    def jql_by_project(project):
        """Generate JQL for filtering by project and redirect to Jira"""
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        base_jql = request.args.get('base_jql')

        # Start with project
        conditions = [f"project = {project}"]

        # Add time filters if specified
        if date_from:
            conditions.append(f"worklogDate >= \"{date_from}\"")
        if date_to:
            conditions.append(f"worklogDate <= \"{date_to}\"")

        # If there's a base JQL, add it as a separate condition
        if base_jql:
            final_jql = f"({base_jql}) AND {' AND '.join(conditions)}"
        else:
            final_jql = ' AND '.join(conditions)

        # Create URL for Jira
        jira_url = "https://jira.nexign.com/issues/?jql=" + final_jql.replace(" ", "%20")

        # Return JSON with URL and JQL
        return jsonify({
            'url': jira_url,
            'jql': final_jql
        })