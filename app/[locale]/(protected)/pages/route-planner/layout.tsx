import { Metadata } from "next";

export const metadata: Metadata = {
  title: "WBSC Pages",
  description: "Pages for dashboard.",
};
const Layout = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

export default Layout;