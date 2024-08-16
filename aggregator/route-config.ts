interface RouteConfig {
    actionName: string;
    route: string[];
    finalResult?: string;
  }
  
  const routeConfig: RouteConfig[] = [
    { actionName: 'getUserList', route: ["product.getProductList","user.getUserList"], finalResult: "getUserListResult" },
    { actionName: 'getRoleList', route: ["user.getRoleList"]},
    { actionName: 'getProductList', route: ["product.getProductCategoriesList", "product.getProductList"] },
    { actionName: 'getProductCategoriesList', route: ["product.getProductCategoriesList"] }
  ];
  
  export default routeConfig;
  