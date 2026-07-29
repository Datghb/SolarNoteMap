export function getOAuthRedirectUrl(location: Pick<Location, 'origin'> = window.location): string {
  return location.origin;
}
