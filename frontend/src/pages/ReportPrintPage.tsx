import React from "react";
import { Navigate, useSearchParams } from "react-router-dom";

function ReportPrintPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.toString();

  return <Navigate to={`/reports${query ? `?${query}` : ""}`} replace />;
}

export default ReportPrintPage;
