

export type SubChildren = {
  href: string;
  label: string;
  active: boolean;
  children?: SubChildren[];
};
export type Submenu = {
  href: string;
  label: string;
  active: boolean;
  icon: any;
  submenus?: Submenu[];
  children?: SubChildren[];
};

export type Menu = {
  href: string;
  label: string;
  active: boolean;
  icon: any;
  submenus: Submenu[];
  id: string;
};

export type Group = {
  groupLabel: string;
  menus: Menu[];
  id: string;
};

export function getMenuList(pathname: string, t: any): Group[] {

  return [
    {
      groupLabel: t("dashboard"),
      id: "dashbard",
      menus: [
        {
          id: "overview",
          href: "/dashboard/overview",
          label: t("overview"),
          active: pathname.includes("/dashboard/overview"),
          icon: "heroicons-outline:circle-stack",
          submenus: [],
        },
      ]
    },
    {
      groupLabel: t("pages"),
      id: "pages",
      menus: [
        {
          id: "csv-converter",
          href: "/pages/csv-converter",
          label: t("csv-converter"),
          active: pathname.includes("/pages/csv-converter"),
          icon: "heroicons-outline:document",
          submenus: [],
        },
      ],
    },
    
  ];
}
export function getHorizontalMenuList(pathname: string, t: any): Group[] {
  return [
    {
      groupLabel: t("dashboard"),
      id: "dashboard",
      menus: [
        {
          id: "csv converter",
          href: "/",
          label: t("csv converter"),
          active: pathname.includes("/"),
          icon: "heroicons-outline:code-bracket",
          submenus:[],
        },
      ],
    },

    
  ];
}