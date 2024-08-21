interface RouteConfig {
    actionName: string;
    route: string[];
    finalResult: string;
  }
  
  const routeConfig: RouteConfig[] = [
    { actionName: 'getUserList', route: ["product.getProductList","user.getUserList"], finalResult: "getUserListResult" },
    { actionName: 'getRoleList', route: ["user.getRoleList"], finalResult: "getRoleListResult"},
    { actionName: 'getProductList', route: ["product.getProductList"], finalResult: "getProductListResult" },
    { actionName: 'getProductCategoriesList', route: ["product.getProductCategoriesList"], finalResult: "getProductCategoriesResult"  }
  ];
  
  export default routeConfig;
  