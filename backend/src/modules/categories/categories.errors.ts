export class CategoryError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number
  ) {
    super(message)
    this.name = 'CategoryError'
  }
}

export const CategoryErrors = {
  NOT_FOUND: () =>
    new CategoryError(
      'CATEGORY_NOT_FOUND',
      'Category not found',
      404
    ),

  ALREADY_EXISTS: (code: string) =>
    new CategoryError(
      'CATEGORY_CODE_EXISTS',
      `Category with code '${code}' already exists`,
      409
    ),

  INVALID_CODE: () =>
    new CategoryError(
      'INVALID_CATEGORY_CODE',
      'Category code must not exceed 50 characters',
      400
    ),

  INVALID_NAME: () =>
    new CategoryError(
      'INVALID_CATEGORY_NAME',
      'Category name is required and must not exceed 255 characters',
      400
    ),
}
