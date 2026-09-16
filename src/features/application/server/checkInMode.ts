export const CHECK_IN_MODE_HEADER = "x-parari-check-in-mode";
export const CHECK_IN_MODE_VALUE = "dedicated";

export function isDedicatedCheckInRequest(request: Request) {
  return (
    request.headers.get(CHECK_IN_MODE_HEADER)?.trim().toLowerCase() ===
    CHECK_IN_MODE_VALUE
  );
}
