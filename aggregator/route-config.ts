interface RouteConfig {
    actionName: string;
    route: string[];
  }
  
  const routeConfig: RouteConfig[] = [
    { actionName: 'getUserList', route: ["product.getProductList","user.getUserList"] },
    { actionName: 'getRoleList', route: ["user.getRoleList"]},
    { actionName: 'getProductList', route: ["product.getProductCategoriesList", "product.getProductList"] },
    { actionName: 'getProductCategoriesList', route: ["product.getProductCategoriesList"] }
  ];
  
  export default routeConfig;
  