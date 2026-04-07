import type { UserProfile, UserOrder, UserAddress } from "../../types/user";
import type { Product } from "../../types/product";
import { productList } from "./productData";

const addresses: UserAddress[] = [
  {
    receiverName: "John",
    address: "28 whatever Str",
    city: "Ho Chi Minh",
    country: "Vietnam",
  },
  {
    receiverName: "Alex",
    address: "39 whatever Str",
    city: "Los Angeles",
    country: "US",
  },
  {
    receiverName: "Jenny",
    address: "90 whatever Str",
    city: "Ha Noi",
    country: "Vietnam",
  },
  {
    receiverName: "Jake",
    address: "10 whatever Str",
    city: "California",
    country: "US",
  },
];

const getRandomAddress = (): UserAddress => {
  const addressesList = [...addresses].sort(() => 0.5 - Math.random());
  return addressesList[0];
}

const getRandomProducts = (count: number = 3): Product[] => {
  const shuffled = [...productList].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

const order: UserOrder[] = [
    {
      address: getRandomAddress(),
      product: getRandomProducts(),
      orderDate: "26/12/2025",
      shipDate: "28/12/2025",
      shipFee: "10.00$",
      status: "Confirming",
    },
    {
      address: getRandomAddress(),
      product: getRandomProducts(),
      orderDate: "26/12/2025",
      shipDate: "28/12/2025",
      shipFee: "10.00$",
      status: "Confirming",
    },
    {
      address: getRandomAddress(),
      product: getRandomProducts(),
      orderDate: "28/12/2025",
      shipDate: "30/12/2025",
      shipFee: "15.00$",
      status: "Shipping",
    },
    {
      address: getRandomAddress(),
      product: getRandomProducts(),
      orderDate: "01/01/2026",
      shipDate: "03/01/2026",
      shipFee: "20.00$",
      status: "Completed",
    },
];
const finishedOrder: UserOrder[] = [
    {
      address: getRandomAddress(),
      product: getRandomProducts(),
      orderDate: "26/12/2025",
      shipDate: "28/12/2025",
      shipFee: "10.00$",
      status: "Confirming",
    },
    {
      address: getRandomAddress(),
      product: getRandomProducts(),
      orderDate: "26/12/2025",
      shipDate: "28/12/2025",
      shipFee: "10.00$",
      status: "Confirming",
    },
    {
      address: getRandomAddress(),
      product: getRandomProducts(),
      orderDate: "28/12/2025",
      shipDate: "30/12/2025",
      shipFee: "15.00$",
      status: "Shipping",
    },
    {
      address: getRandomAddress(),
      product: getRandomProducts(),
      orderDate: "01/01/2026",
      shipDate: "03/01/2026",
      shipFee: "20.00$",
      status: "Completed",
    },
];

export const INITIAL_MOCK_USERS: UserProfile = {
  id: "user-123",
  avatar: "https://placehold.co/150",
  firstName: "Huy",
  lastName: "Nguyen",
  gender: "Male",
  birthday: "01/01/2000",
  displayName: "Huy Odyssey",
  username: "huynguyen",
  password: "*************",
  email: "user@gmail.com",
  phone: "028 4532 6499",
  amountSpent: 1234.56,
  userAddresses: addresses,
  userOrders: order,
  userFinishedOrders: finishedOrder,
  userWishlist: getRandomProducts(5),
};
