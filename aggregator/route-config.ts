interface RouteConfig {
    actionName: string;
    route: string[];
    finalResult: string;
  }
  
  const routeConfig: RouteConfig[] = [
    { actionName: 'getUserList', route: ["product.getProductList","user.getUserList"], finalResult: "user.getUserList" },
    { actionName: 'getRoleList', route: ["user.getRoleList"], finalResult: "user.getRoleList"},
    { actionName: 'getProductList', route: ["product.getProductList"], finalResult: "getProductListResult" },
    { actionName: 'getProductCategoriesList', route: ["product.getProductCategoriesList"], finalResult: "product.getProductCategoriesList"  }
  ];
  
  export default routeConfig;
  