Pod::Spec.new do |s|
  s.name = 'FridayAidot'
  s.version = '1.0.0'
  s.summary = "Friday's AiDot lights add-on"
  s.license = 'MIT'
  s.homepage = 'https://github.com/wicked9787/friday'
  s.author = 'Friday'
  s.source = { :git => 'https://github.com/wicked9787/friday.git', :tag => s.version.to_s }
  s.source_files = 'ios/Sources/**/*.{swift,h,m}'
  s.ios.deployment_target = '15.0'
  s.dependency 'Capacitor'
  s.frameworks = 'Network', 'Security'
  s.swift_version = '5.9'
end
