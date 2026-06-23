import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export function IsLessThan(
  property: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isLessThan',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [property],
      options: validationOptions,
      validator: {
        // Đổi value: any thành value: unknown để đảm bảo Type Safety
        validate(value: unknown, args: ValidationArguments) {
          // Ép kiểu constraints về tuple [string] để tránh lỗi mảng any
          const [relatedPropertyName] = args.constraints as [string];

          // Ép kiểu object về Record<string, unknown> để truy cập property an toàn
          const relatedValue = (args.object as Record<string, unknown>)[
            relatedPropertyName
          ];

          if (relatedValue === undefined || relatedValue === null) return true;

          return (
            typeof value === 'number' &&
            typeof relatedValue === 'number' &&
            value <= relatedValue
          );
        },
        defaultMessage(args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints as [string];
          return `${args.property} không được lớn hơn ${relatedPropertyName}`;
        },
      },
    });
  };
}
