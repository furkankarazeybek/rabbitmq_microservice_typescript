interface RouteConfig {
    actionName: string;
    serviceName: string;
    route: string[];
  }
  
  const routeConfig: RouteConfig[] = [
    { actionName: 'getUserList', serviceName:"user", route: ["user.getUserList","product.getProductList"] },
    { actionName: 'getRoleList', serviceName:"user", route: ["user.getRoleList"]},
    { actionName: 'getProductList', serviceName:"product", route: ["product.getProductList", "product.getProductCategoriesList"] }
  ];
  
  export default routeConfig;
  