// Retired runner: the reviewed Gateway workflow is the sole execution path.
// Do not silently fall back to scripted reports or let shoppers grade themselves.
function retired() {
  return Response.json(
    {
      apiVersion: 'v1',
      error: {
        code: 'WORKFLOW_MOVED',
        message:
          'Use /api/gateway/drafts to inspect and review a test plan, then create and run a scan through /api/gateway/scans.',
        retryable: false,
      },
    },
    { status: 410, headers: { 'Cache-Control': 'private, no-store' } },
  );
}
export { retired as GET, retired as POST };
