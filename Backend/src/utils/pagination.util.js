export const paginate = (paginateResult) => ({
  results: paginateResult.results,
  pagination: {
    total: paginateResult.total,
    pages: paginateResult.pages,
    page: paginateResult.page,
    limit: paginateResult.limit,
    next: paginateResult.next ?? null,
    prev: paginateResult.prev ?? null,
  },
});