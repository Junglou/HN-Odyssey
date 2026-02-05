import React from "react";

// Props chung
interface IconProps {
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

// 1. User Icon (My Profile)
export const UserIcon: React.FC<IconProps> = ({
  width = 24,
  height = 24,
  color = "currentColor",
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// 2. Map Icon (Address Management)
export const MapIcon: React.FC<IconProps> = ({
  width = 24,
  height = 24,
  color = "currentColor",
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M21 10C21 17 12 23 12 23C12 23 3 17 3 10C3 7.61305 3.94821 5.32387 5.63604 3.63604C7.32387 1.94821 9.61305 1 12 1C14.3869 1 16.6761 1.94821 18.364 3.63604C20.0518 5.32387 21 7.61305 21 10Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 13C13.6569 13 15 11.6569 15 10C15 8.34315 13.6569 7 12 7C10.3431 7 9 8.34315 9 10C9 11.6569 10.3431 13 12 13Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// 3. Cart Icon (Order Management)
export const CartIcon: React.FC<IconProps> = ({
  width = 24,
  height = 24,
  color = "currentColor",
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M9 20C9.55228 20 10 19.5523 10 19C10 18.4477 9.55228 18 9 18C8.44772 18 8 18.4477 8 19C8 19.5523 8.44772 20 9 20Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M20 20C20.5523 20 21 19.5523 21 19C21 18.4477 20.5523 18 20 18C19.4477 18 19 18.4477 19 19C19 19.5523 19.4477 20 20 20Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M1 1H4L6.68 14.39C6.77144 14.8504 7.02191 15.264 7.38755 15.5583C7.75318 15.8526 8.2107 16.009 8.68 16H19.4C19.8693 16.009 20.3268 15.8526 20.6925 15.5583C21.0581 15.264 21.3086 14.8504 21.4 14.39L23 6H6"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// 4. History Icon (Purchase History / Recent)
export const HistoryIcon: React.FC<IconProps> = ({
  width = 24,
  height = 24,
  color = "currentColor",
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 8V12L15 15"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3.05 11C3.05 11 2.97 11.09 3 12C3 16.97 7.03 21 12 21C16.97 21 21 16.97 21 12C21 7.03 16.97 3 12 3C9.13 3 6.57 4.34 4.92 6.5"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3 3V7H7"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// 5. Heart Icon (My Wishlist)
export const HeartIcon: React.FC<IconProps> = ({
  width = 24,
  height = 24,
  color = "currentColor",
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M20.84 4.61001C20.3292 4.09901 19.7228 3.69365 19.0554 3.41709C18.3879 3.14053 17.6725 2.99818 16.95 2.99818C16.2275 2.99818 15.5121 3.14053 14.8446 3.41709C14.1772 3.69365 13.5708 4.09901 13.06 4.61001L12 5.67001L10.94 4.61001C9.9083 3.57831 8.50903 2.99871 7.05 2.99871C5.59096 2.99871 4.19169 3.57831 3.16 4.61001C2.1283 5.64171 1.54871 7.04098 1.54871 8.50001C1.54871 9.95904 2.1283 11.3583 3.16 12.39L4.22 13.45L12 21.23L19.78 13.45L20.84 12.39C21.351 11.8792 21.7563 11.2728 22.0329 10.6054C22.3094 9.9379 22.4518 9.22249 22.4518 8.50001C22.4518 7.77753 22.3094 7.06212 22.0329 6.39465C21.7563 5.72718 21.351 5.12081 20.84 4.61001V4.61001Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// 6. Ticket Icon (My Coupon)
export const TicketIcon: React.FC<IconProps> = ({
  width = 24,
  height = 24,
  color = "currentColor",
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M13 10V14"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M2 10V6C2 4.89543 2.89543 4 4 4H20C21.1046 4 22 4.89543 22 6V10C22 11.1046 21.1046 12 20 12C21.1046 12 22 12.8954 22 14V18C22 19.1046 21.1046 20 20 20H4C2.89543 20 2 19.1046 2 18V14C2 12.8954 2.89543 12 4 12C2.89543 12 2 11.1046 2 10Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// 7. Crown Icon (Loyalty)
export const CrownIcon: React.FC<IconProps> = ({
  width = 24,
  height = 24,
  color = "currentColor",
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M2 4L5 20H19L22 4L16.5 7L12 2L7.5 7L2 4Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// 8. Logout Icon
export const LogoutIcon: React.FC<IconProps> = ({
  width = 24,
  height = 24,
  color = "currentColor",
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M16 17L21 12L16 7"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M21 12H9"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Social Media Icons
export const FacebookIcon = ({ width = 18, height = 18 }) => (
  <svg width={width} height={height} viewBox="0 0 24 24" fill="currentColor">
    <path d="M14 13.5H16.5L17.5 9.5H14V7.5C14 6.47 14 5.5 16 5.5H17.5V2.14C17.174 2.097 15.943 2 14.643 2C11.928 2 10 3.657 10 6.7V9.5H7V13.5H10V22H14V13.5Z" />
  </svg>
);

export const InstagramIcon = ({ width = 18, height = 18 }) => (
  <svg width={width} height={height} viewBox="0 0 24 24" fill="currentColor">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2.163C15.204 2.163 15.584 2.175 16.85 2.232C18.108 2.29 18.963 2.5 19.71 2.79C20.484 3.091 21.036 3.491 21.589 4.044C22.142 4.597 22.542 5.15 22.842 5.923C23.133 6.67 23.342 7.525 23.4 8.783C23.457 10.049 23.469 10.429 23.469 13.633C23.469 16.836 23.457 17.217 23.4 18.483C23.342 19.74 23.133 20.595 22.842 21.342C22.542 22.115 22.142 22.668 21.589 23.221C21.036 23.774 20.484 24.174 19.71 24.475C18.963 24.765 18.108 24.975 16.85 25.032C15.584 25.09 15.204 25.102 12 25.102C8.796 25.102 8.416 25.09 7.15 25.032C5.892 24.975 5.037 24.765 4.29 24.475C3.516 24.174 2.964 23.774 2.411 23.221C1.858 22.668 1.458 22.115 1.158 21.342C0.867 20.595 0.658 19.74 0.6 18.483C0.543 17.217 0.531 16.836 0.531 13.633C0.531 10.429 0.543 10.049 0.6 8.783C0.658 7.525 0.867 6.67 1.158 5.923C1.458 5.15 1.858 4.597 2.411 4.044C2.964 3.491 3.516 3.091 4.29 2.79C5.037 2.5 5.892 2.29 7.15 2.232C8.416 2.175 8.796 2.163 12 2.163ZM12 0C8.741 0 8.333 0.014 7.053 0.072C5.775 0.131 4.903 0.333 4.14 0.63C3.351 0.936 2.683 1.347 2.018 2.012C1.353 2.677 0.942 3.345 0.636 4.134C0.339 4.897 0.137 5.769 0.078 7.047C0.02 8.327 0.006 8.735 0.006 11.994C0.006 15.253 0.02 15.661 0.078 16.941C0.137 18.219 0.339 19.091 0.636 19.854C0.942 20.643 1.353 21.311 2.018 21.976C2.683 22.641 3.351 23.052 4.14 23.358C4.903 23.655 5.775 23.857 7.053 23.916C8.333 23.974 8.741 23.988 12 23.988C15.259 23.988 15.667 23.974 16.947 23.916C18.225 23.857 19.097 23.655 19.86 23.358C20.649 23.052 21.317 22.641 21.982 21.976C22.647 21.311 23.058 20.643 23.364 19.854C23.661 19.091 23.863 18.219 23.922 16.941C23.98 15.661 23.994 15.253 23.994 11.994C23.994 8.735 23.98 8.327 23.922 7.047C23.863 5.769 23.661 4.897 23.364 4.134C23.058 3.345 22.647 2.677 21.982 2.012C21.317 1.347 20.649 0.936 19.86 0.63C19.097 0.333 18.225 0.131 16.947 0.072C15.667 0.014 15.259 0 12 0Z"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 5.838C8.599 5.838 5.838 8.599 5.838 12C5.838 15.401 8.599 18.162 12 18.162C15.401 18.162 18.162 15.401 18.162 12C18.162 8.599 15.401 5.838 12 5.838ZM12 16C9.791 16 8 14.209 8 12C8 9.791 9.791 8 12 8C14.209 8 16 9.791 16 12C16 14.209 14.209 16 12 16Z"
    />
    <path d="M20.452 5.168C20.452 6.096 19.7 6.848 18.772 6.848C17.844 6.848 17.092 6.096 17.092 5.168C17.092 4.24 17.844 3.488 18.772 3.488C19.7 3.488 20.452 4.24 20.452 5.168Z" />
  </svg>
);

export const TiktokIcon = ({ width = 18, height = 18 }) => (
  <svg width={width} height={height} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.589 6.686C17.788 6.686 16.115 6.059 14.771 5.011V15.586C14.771 18.966 12.031 21.706 8.651 21.706C5.271 21.706 2.531 18.966 2.531 15.586C2.531 12.206 5.271 9.466 8.651 9.466C9.091 9.466 9.518 9.527 9.929 9.641V12.793C9.551 12.636 9.117 12.535 8.651 12.535C6.968 12.535 5.602 13.901 5.602 15.586C5.602 17.271 6.968 18.637 8.651 18.637C10.334 18.637 11.7 17.271 11.7 15.586V2H14.771C14.771 4.091 16.467 5.786 18.558 5.786V8.857C18.558 7.828 17.962 6.938 17.078 6.463C17.854 6.757 18.702 6.915 19.589 6.915V6.686Z" />
  </svg>
);

export const XIcon = ({ width = 18, height = 18 }) => (
  <svg width={width} height={height} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25H21.552L14.325 10.51L22.827 21.75H16.17L10.956 14.933L4.99003 21.75H1.68003L9.41003 12.915L1.25403 2.25H8.08003L12.793 8.481L18.244 2.25ZM17.083 19.77H18.916L7.08403 4.126H5.11703L17.083 19.77Z" />
  </svg>
);
