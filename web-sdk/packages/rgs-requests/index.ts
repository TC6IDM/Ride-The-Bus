export * from './src/rgs-requests';
export * from './src/types';

// LOCAL ADDITION to the Stake SDK - re-apply if this package is updated from
// upstream. Re-exported so a game can tell a rate limit from a real failure
// without taking a direct dependency on rgs-fetcher, which is an internal of
// this package rather than something apps declare.
export { RgsHttpError } from 'rgs-fetcher';
